import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';

import { consumeTrainingTabArm, triggerTabPressFeedback } from '@/lib/app-feedback';
import { DEFAULT_UI_SOUND_ID } from '@/lib/app-feedback-sounds';

export function FeedbackTabBarButton(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (!consumeTrainingTabArm()) {
          triggerTabPressFeedback({ soundId: DEFAULT_UI_SOUND_ID });
        }
        props.onPressIn?.(ev);
      }}
      onPress={(ev) => {
        props.onPress?.(ev);
      }}
    />
  );
}
