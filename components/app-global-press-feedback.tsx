import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { appFeedbackTouchHandlers } from '@/lib/app-feedback-touch';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Root omotač — tap vs scroll (zvuk/vibracija samo na tap). */
export function AppGlobalPressFeedback({ children, style }: Props) {
  return (
    <View style={[{ flex: 1 }, style]} {...appFeedbackTouchHandlers}>
      {children}
    </View>
  );
}
