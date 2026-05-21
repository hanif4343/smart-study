package com.hanif.smart_study;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";

    // WebView instance - FCM service থেকে JS call করার জন্য static রাখা হয়েছে
    public static WebView webViewInstance = null;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST = 1001;

    // Android 13+ এ Notification Permission চাওয়ার জন্য
    private ActivityResultLauncher<String> notificationPermissionLauncher;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Full screen immersive
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        webViewInstance = webView; // static reference সেট করুন

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setGeolocationEnabled(false);
        // Cache — আগের cache থাকলে দ্রুত load হবে
        settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);

        // WebView background purple করো — load এর আগে white screen দেখাবে না
        webView.setBackgroundColor(android.graphics.Color.parseColor("#4f46e5"));

        // JavaScript Interface for native features
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Content load হলে background transparent করো
                view.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                // Page load হওয়ার পর FCM token WebView-এ পাঠান
                sendFCMTokenToWebView();

                // Notification এর মাধ্যমে app খুললে URL navigate করুন
                String notifUrl = getIntent().getStringExtra("notification_url");
                if (notifUrl != null && !notifUrl.isEmpty()) {
                    String js = "javascript:if(typeof navigateTo === 'function') { navigateTo('" + notifUrl + "'); }";
                    view.loadUrl(js);
                    getIntent().removeExtra("notification_url");
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("fb://")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception e) {
                        startActivity(new Intent(Intent.ACTION_VIEW,
                            Uri.parse(url.replace("fb://facewebmodal/f?href=", ""))));
                    }
                    return true;
                }
                if (url.startsWith("vnd.youtube:")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception e) {
                        String videoId = url.replace("vnd.youtube:", "");
                        startActivity(new Intent(Intent.ACTION_VIEW,
                            Uri.parse("https://www.youtube.com/watch?v=" + videoId)));
                    }
                    return true;
                }
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (!url.contains("file://") && !url.contains("smartentrydb") &&
                        !url.contains("googleapis.com") && !url.contains("script.google.com")) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        return true;
                    }
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) { return true; }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, android.webkit.JsResult result) {
                result.cancel(); return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                result.cancel(); return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, android.webkit.JsPromptResult result) {
                result.cancel(); return true;
            }
        });

        // Notification Permission Request (Android 13+)
        notificationPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            isGranted -> {
                if (isGranted) {
                    Log.d(TAG, "Notification permission দেওয়া হয়েছে");
                } else {
                    Toast.makeText(this, "Notification বন্ধ আছে। Settings থেকে চালু করুন।", Toast.LENGTH_LONG).show();
                }
            }
        );

        // Setup steps
        createNotificationChannel();
        requestNotificationPermission();
        fetchFCMToken();

        webView.loadUrl("file:///android_asset/index.html");
    }

    private void fetchFCMToken() {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    Log.e(TAG, "FCM Token নিতে সমস্যা হয়েছে", task.getException());
                    return;
                }
                String token = task.getResult();
                Log.d(TAG, "FCM Token: " + token);
                getSharedPreferences("FCM", MODE_PRIVATE)
                    .edit().putString("token", token).apply();
            });
    }

    private void sendFCMTokenToWebView() {
        String token = getSharedPreferences("FCM", MODE_PRIVATE).getString("token", "");
        if (!token.isEmpty()) {
            String js = "javascript:if(typeof onFCMTokenReceived === 'function') { onFCMTokenReceived('" + token + "'); }";
            webView.loadUrl(js);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "smart_study_channel",
                "Smart Study Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Smart Study থেকে গুরুত্বপূর্ণ notification পাবেন");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS);
            }
        }
    }

    public class AndroidBridge {

        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) v.vibrate(ms);
        }

        @JavascriptInterface
        public boolean isOnline() {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager)
                getSystemService(CONNECTIVITY_SERVICE);
            android.net.NetworkInfo ni = cm.getActiveNetworkInfo();
            return ni != null && ni.isConnected();
        }

        @JavascriptInterface
        public void openFacebook(String url) {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("fb://facewebmodal/f?href=" + url)));
                } catch (Exception e) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                }
            });
        }

        @JavascriptInterface
        public void openYoutube(String url) {
            runOnUiThread(() -> {
                try {
                    String videoId = url.contains("v=") ? url.split("v=")[1].split("&")[0]
                        : url.substring(url.lastIndexOf("/") + 1);
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("vnd.youtube:" + videoId)));
                } catch (Exception e) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                }
            });
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(() -> finishAndRemoveTask());
        }

        /** JavaScript থেকে FCM Token নিন: AndroidBridge.getFCMToken() */
        @JavascriptInterface
        public String getFCMToken() {
            return getSharedPreferences("FCM", MODE_PRIVATE).getString("token", "");
        }

        /** Topic subscribe করুন: AndroidBridge.subscribeToTopic("all_users") */
        @JavascriptInterface
        public void subscribeToTopic(String topic) {
            FirebaseMessaging.getInstance().subscribeToTopic(topic)
                .addOnCompleteListener(task -> {
                    Log.d(TAG, "Subscribe '" + topic + "': " + task.isSuccessful());
                    runOnUiThread(() -> webView.loadUrl(
                        "javascript:if(typeof onTopicSubscribed === 'function') { onTopicSubscribed('" + topic + "', " + task.isSuccessful() + "); }"
                    ));
                });
        }

        /** Topic unsubscribe করুন: AndroidBridge.unsubscribeFromTopic("all_users") */
        @JavascriptInterface
        public void unsubscribeFromTopic(String topic) {
            FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)
                .addOnCompleteListener(task -> Log.d(TAG, "Unsubscribe '" + topic + "': " + task.isSuccessful()));
        }

        /**
         * Daily reminder schedule করো।
         * JS থেকে: AndroidBridge.scheduleReminder("07:00", "সকালের Reminder", "পড়ার সময়!", 1001)
         * @param timeStr  "HH:MM" format
         * @param title    Notification title
         * @param body     Notification body
         * @param notifId  Unique ID — morning=1001, night=1002
         */
        @JavascriptInterface
        public void scheduleReminder(String timeStr, String title, String body, int notifId) {
            // SharedPreferences এ save করো — boot এর পর reschedule এর জন্য
            getSharedPreferences("reminders", MODE_PRIVATE).edit()
                .putString(notifId == 1001 ? "morning_time" : "night_time", timeStr)
                .putString(notifId == 1001 ? "morning_title" : "night_title", title)
                .putString(notifId == 1001 ? "morning_body"  : "night_body",  body)
                .apply();

            ReminderHelper.scheduleDaily(MainActivity.this, timeStr, title, body, notifId);
            Log.d(TAG, "Reminder scheduled: " + timeStr + " (id=" + notifId + ")");
        }

        /**
         * Reminder cancel করো।
         * JS থেকে: AndroidBridge.cancelReminder(1001)
         */
        @JavascriptInterface
        public void cancelReminder(int notifId) {
            ReminderHelper.cancel(MainActivity.this, notifId);
            // SharedPreferences থেকেও মুছো
            getSharedPreferences("reminders", MODE_PRIVATE).edit()
                .remove(notifId == 1001 ? "morning_time" : "night_time")
                .apply();
            Log.d(TAG, "Reminder cancelled: id=" + notifId);
        }

        /**
         * Android 12+ এ exact alarm permission আছে কিনা চেক করো।
         * JS থেকে: AndroidBridge.canScheduleExactAlarms()
         * Returns true/false
         */
        @JavascriptInterface
        public boolean canScheduleExactAlarms() {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                android.app.AlarmManager am = (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
                return am != null && am.canScheduleExactAlarms();
            }
            return true; // Android 11 এর নিচে সবসময় true
        }

        /**
         * Android 12+ এ exact alarm permission settings page খোলো।
         * JS থেকে: AndroidBridge.openAlarmPermissionSettings()
         */
        @JavascriptInterface
        public void openAlarmPermissionSettings() {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                runOnUiThread(() -> {
                    try {
                        android.content.Intent i = new android.content.Intent(
                            android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                        startActivity(i);
                    } catch (Exception e) {
                        Log.e(TAG, "Cannot open alarm settings", e);
                    }
                });
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String notifUrl = intent.getStringExtra("notification_url");
        if (notifUrl != null && !notifUrl.isEmpty() && webView != null) {
            webView.loadUrl("javascript:if(typeof navigateTo === 'function') { navigateTo('" + notifUrl + "'); }");
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] results = (resultCode == Activity.RESULT_OK && data != null)
                ? new Uri[]{data.getData()} : null;
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webViewInstance = webView;
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        webViewInstance = null;
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
    }
}
