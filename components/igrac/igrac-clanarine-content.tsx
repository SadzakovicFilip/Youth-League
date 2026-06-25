import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';
import type { IgracFeeRow } from '@/lib/igrac-dashboard-types';
import { monthTitleSr } from '@/lib/match-calendar-utils';

import { IgracScreenState } from './igrac-screen-state';

function parsePeriodMonth(period: string): { year: number; month: number } | null {
  const s = period.trim();
  const iso =
    s.includes('T') ? s : s.length >= 10 ? `${s.slice(0, 10)}T12:00:00` : `${s}-01T12:00:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() };
}

function formatPeriodMonthLabel(period: string): string {
  const p = parsePeriodMonth(period);
  if (!p) return period;
  const t = monthTitleSr(p.year, p.month);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function feeRemaining(row: IgracFeeRow): number {
  return Math.max(0, Number(row.amount_due) - Number(row.amount_paid));
}

function isFeePaid(row: IgracFeeRow): boolean {
  return feeRemaining(row) <= 0;
}

function formatAmount(n: number): string {
  return Math.round(n).toLocaleString('sr-Latn');
}

function formatRatio(paid: number, due: number): string {
  return `${formatAmount(paid)} / ${formatAmount(due)} RSD`;
}

type FeeCardProps = {
  title: string;
  subtitle?: string;
  ok: boolean;
  showCheckWatermark: boolean;
  centered?: boolean;
};

function FeeCard({ title, subtitle, ok, showCheckWatermark, centered = false }: FeeCardProps) {
  const { colors } = useAppTheme();
  const [shellH, setShellH] = useState(56);
  const accent = ok ? colors.success : colors.danger;
  const watermarkSize = Math.round(Math.max(44, Math.min(100, shellH * 0.9)));

  return (
    <ThemedView
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - shellH) > 1) setShellH(h);
      }}
      style={[
        styles.card,
        {
          borderColor: accent,
          backgroundColor: ok ? `${colors.success}14` : `${colors.danger}14`,
        },
      ]}>
      {showCheckWatermark ? (
        <View pointerEvents="none" style={styles.watermarkWrap}>
          <MaterialIcons name="check" size={watermarkSize} color={accent} style={styles.watermarkIcon} />
        </View>
      ) : null}
      <View style={centered ? styles.contentCentered : styles.contentLeft}>
        <ThemedText
          type="defaultSemiBold"
          style={[
            styles.cardTitle,
            { color: colors.text },
            centered && styles.textCenter,
          ]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            style={[
              styles.cardSubtitle,
              { color: ok ? colors.textSecondary : colors.text },
              centered && styles.textCenter,
            ]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </ThemedView>
  );
}

export function IgracClanarineContent({ embedded = false }: { embedded?: boolean }) {
  const { colors } = useAppTheme();
  const { loading, errorMessage, data } = useIgracDashboard();
  const fees = data?.fees ?? [];

  const { totalDebt, unpaidMonthLabels } = useMemo(() => {
    let debt = 0;
    const labels: string[] = [];
    for (const row of fees) {
      const rem = feeRemaining(row);
      if (rem > 0) {
        debt += rem;
        labels.push(formatPeriodMonthLabel(row.period_month));
      }
    }
    return { totalDebt: debt, unpaidMonthLabels: labels };
  }, [fees]);

  const noDebt = totalDebt <= 0;

  const totalDebtSubtitle = noDebt
    ? 'Nema duga'
    : [
        `${formatAmount(totalDebt)} RSD`,
        unpaidMonthLabels.length > 0 ? `Meseci: ${unpaidMonthLabels.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');

  return (
    <>
      {!embedded ? (
        <ThemedText type="subtitle" style={{ color: colors.text }}>
          Članarina
        </ThemedText>
      ) : null}

      <IgracScreenState loading={loading} errorMessage={errorMessage} />

      {!loading && !errorMessage ? (
        fees.length === 0 ? (
          <ThemedView style={[styles.empty, { borderColor: colors.borderStrong }]}>
            <ThemedText style={{ color: colors.textSecondary }}>Nema unosa.</ThemedText>
          </ThemedView>
        ) : (
          <>
            <FeeCard
              title="UKUPAN DUG"
              subtitle={totalDebtSubtitle}
              ok={noDebt}
              showCheckWatermark={noDebt}
              centered
            />

            {fees.map((row) => {
              const paid = isFeePaid(row);
              return (
                <FeeCard
                  key={row.id}
                  title={formatPeriodMonthLabel(row.period_month)}
                  subtitle={formatRatio(row.amount_paid, row.amount_due)}
                  ok={paid}
                  showCheckWatermark={paid}
                />
              );
            })}
          </>
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  contentLeft: {
    gap: 2,
    alignItems: 'flex-start',
  },
  contentCentered: {
    gap: 4,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  textCenter: {
    textAlign: 'center',
  },
  empty: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  watermarkWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkIcon: {
    opacity: 0.16,
  },
});
