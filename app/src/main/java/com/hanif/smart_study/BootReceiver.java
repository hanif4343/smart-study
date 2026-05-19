package com.hanif.smart_study;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // Phone restart হলে SharedPreferences থেকে saved reminders পড়ে reschedule করো
        SharedPreferences prefs = context.getSharedPreferences("reminders", Context.MODE_PRIVATE);
        String morningTime = prefs.getString("morning_time", "");
        String nightTime   = prefs.getString("night_time",   "");

        if (!morningTime.isEmpty()) {
            ReminderHelper.scheduleDaily(context, morningTime,
                "📚 পড়ার সময় হয়েছে!", "Smart Study খুলে আজকের লক্ষ্য পূরণ করো 🎯", 1001);
        }
        if (!nightTime.isEmpty()) {
            ReminderHelper.scheduleDaily(context, nightTime,
                "🌙 রাতের Reminder", "ঘুমানোর আগে পড়ার অভ্যাস ধরে রাখো 🔥", 1002);
        }
    }
}
