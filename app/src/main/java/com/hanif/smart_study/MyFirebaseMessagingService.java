package com.hanif.smart_study;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * MyFirebaseMessagingService
 * FCM notification receive ও handle করার জন্য এই service টি ব্যবহার হয়।
 * App foreground বা background যেকোনো অবস্থায় notification দেখাবে।
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FCM_Service";
    private static final String CHANNEL_ID = "smart_study_channel";
    private static final String CHANNEL_NAME = "Smart Study Notifications";
    private static final int NOTIFICATION_ID = 1001;

    /**
     * নতুন FCM Token পাওয়া গেলে এই method call হয়।
     * Token পরিবর্তন হলেও এটি call হয়।
     */
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "নতুন FCM Token পাওয়া গেছে: " + token);

        // Token টি আপনার server-এ save করুন
        // এই token দিয়ে নির্দিষ্ট device-এ notification পাঠানো যাবে
        sendTokenToServer(token);
    }

    /**
     * FCM notification আসলে এই method call হয়।
     * App foreground এ থাকলে এই method-এ handle করতে হয়।
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Log.d(TAG, "FCM Message পাওয়া গেছে - From: " + remoteMessage.getFrom());

        // Notification payload চেক করুন
        String title = "Smart Study";
        String body = "";
        String clickUrl = null;

        if (remoteMessage.getNotification() != null) {
            RemoteMessage.Notification notification = remoteMessage.getNotification();
            if (notification.getTitle() != null) title = notification.getTitle();
            if (notification.getBody() != null) body = notification.getBody();
            Log.d(TAG, "Notification Title: " + title + ", Body: " + body);
        }

        // Data payload চেক করুন (custom data)
        if (!remoteMessage.getData().isEmpty()) {
            Log.d(TAG, "Data Payload: " + remoteMessage.getData());

            // Data থেকে custom fields নিন
            if (remoteMessage.getData().containsKey("title")) {
                title = remoteMessage.getData().get("title");
            }
            if (remoteMessage.getData().containsKey("body")) {
                body = remoteMessage.getData().get("body");
            }
            if (remoteMessage.getData().containsKey("url")) {
                clickUrl = remoteMessage.getData().get("url");
            }
        }

        // Notification দেখান
        showNotification(title, body, clickUrl);

        // WebView-এ JavaScript call করুন (app foreground এ থাকলে)
        notifyWebView(title, body, clickUrl);
    }

    /**
     * Notification দেখানোর main method
     */
    private void showNotification(String title, String body, String clickUrl) {
        // Notification click করলে MainActivity খুলবে
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        // URL থাকলে সেটি extra হিসেবে পাঠান
        if (clickUrl != null && !clickUrl.isEmpty()) {
            intent.putExtra("notification_url", clickUrl);
        }

        int flags = PendingIntent.FLAG_ONE_SHOT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent, flags
        );

        // Notification sound
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        // Notification builder
        NotificationCompat.Builder notificationBuilder =
            new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body)) // লম্বা text-এর জন্য
                .setAutoCancel(true)  // click করলে dismiss হবে
                .setSound(defaultSoundUri)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent);

        NotificationManager notificationManager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // Android Oreo (API 26+) এর জন্য Notification Channel তৈরি করতে হয়
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Smart Study App Notifications");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            notificationManager.createNotificationChannel(channel);
        }

        notificationManager.notify(NOTIFICATION_ID, notificationBuilder.build());
        Log.d(TAG, "Notification দেখানো হয়েছে: " + title);
    }

    /**
     * App foreground এ থাকলে WebView-এ JavaScript event fire করুন
     */
    private void notifyWebView(String title, String body, String clickUrl) {
        // MainActivity-তে static method call করুন
        if (MainActivity.webViewInstance != null) {
            String url = clickUrl != null ? clickUrl : "";
            String jsCode = String.format(
                "javascript:if(typeof onFCMNotification === 'function') { " +
                "onFCMNotification(%s, %s, %s); }",
                escapeJson(title),
                escapeJson(body),
                escapeJson(url)
            );
            MainActivity.webViewInstance.post(() ->
                MainActivity.webViewInstance.loadUrl(jsCode)
            );
        }
    }

    /**
     * FCM Token server-এ পাঠানোর জন্য (আপনার API endpoint দিন)
     */
    private void sendTokenToServer(String token) {
        // TODO: আপনার server-এ token save করুন
        // উদাহরণ:
        // new Thread(() -> {
        //     try {
        //         URL url = new URL("https://your-server.com/api/save-token");
        //         HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        //         conn.setRequestMethod("POST");
        //         conn.setDoOutput(true);
        //         // token পাঠান...
        //     } catch (Exception e) {
        //         Log.e(TAG, "Token save করতে সমস্যা হয়েছে", e);
        //     }
        // }).start();

        Log.d(TAG, "Token server-এ পাঠানো হবে: " + token);
    }

    /**
     * JSON string escape করার helper method
     */
    private String escapeJson(String text) {
        if (text == null) return "\"\"";
        return "\"" + text
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r") + "\"";
    }
}
