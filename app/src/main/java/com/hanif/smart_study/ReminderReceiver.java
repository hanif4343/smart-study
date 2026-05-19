package com.hanif.smart_study;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public class ReminderReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "smart_study_reminder";

    @Override
    public void onReceive(Context context, Intent intent) {
        String title   = intent.getStringExtra("title");
        String body    = intent.getStringExtra("body");
        String timeStr = intent.getStringExtra("time_str");
        int    notifId = intent.getIntExtra("notif_id", 1001);

        if (title == null) title = "📚 পড়ার সময় হয়েছে!";
        if (body  == null) body  = "Smart Study খুলে আজকের লক্ষ্য পূরণ করো 🎯";

        // Notification দেখাও
        createChannel(context);

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            context, notifId, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setVibrate(new long[]{0, 300, 200, 300});

        NotificationManager nm = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notifId, builder.build());

        // পরের দিনের জন্য reschedule করো (daily repeat)
        if (timeStr != null && !timeStr.isEmpty()) {
            ReminderHelper.scheduleDaily(context, timeStr, title, body, notifId);
        }
    }

    private void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                "Study Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("পড়ার সময়সূচি reminder");
            ch.enableVibration(true);
            ch.setShowBadge(true);
            NotificationManager nm = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }
}
