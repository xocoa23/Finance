import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { FixedExpense } from '../types';
import { formatCurrency } from '../utils/formatters';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notifications = {
  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) return false;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('gastos-fixos', {
        name: 'Lembretes de gastos fixos',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00d4aa',
      });
    }

    return final === 'granted';
  },

  async scheduleFixedExpenseReminder(item: FixedExpense): Promise<string | null> {
    const granted = await this.requestPermissions();
    if (!granted) return null;

    const today = new Date();
    const reminderDate = new Date(today.getFullYear(), today.getMonth(), item.diaVencimento - 3, 9, 0, 0);

    if (reminderDate.getTime() <= today.getTime()) {
      reminderDate.setMonth(reminderDate.getMonth() + 1);
    }

    const trigger: Notifications.DateTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Conta vence em 3 dias',
        body: `${item.descricao} · ${formatCurrency(item.valor)}`,
        data: { fixedExpenseId: item.id },
        sound: 'default',
      },
      trigger,
    });

    return id;
  },

  async cancelByExpenseId(expenseId: string): Promise<void> {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const matches = all.filter((n) => n.content.data?.fixedExpenseId === expenseId);
    await Promise.all(matches.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  },

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async rescheduleAll(items: FixedExpense[]): Promise<void> {
    await this.cancelAll();
    for (const item of items) {
      await this.scheduleFixedExpenseReminder(item);
    }
  },
};
