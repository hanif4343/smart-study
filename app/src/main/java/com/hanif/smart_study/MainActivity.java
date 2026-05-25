package com.hanif.smart_study;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
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
import androidx.core.content.FileProvider;

import com.google.firebase.messaging.FirebaseMessaging;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

import java.io.File;
import java.io.FileOutputStream;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";

    // WebView instance — FCM service থেকে JS call করার জন্য static
    public static WebView webViewInstance = null;
    // App foreground এ আছে কিনা — FCM double notification রোধ করতে
    public static boolean isAppForeground = false;

    private WebView webView;

    // File chooser (modern API)
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private ValueCallback<Uri[]> filePathCallback;

    // Google Sign-in (modern API)
    private ActivityResultLauncher<Intent> googleSignInLauncher;
    private GoogleSignInClient mGoogleSignInClient;

    // Notification permission (Android 13+)
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

        // Register activity result launchers (must be before onStart)
        registerLaunchers();

        webView = findViewById(R.id.webview);
        webViewInstance = webView;

        setupWebView();

        // App setup
        createNotificationChannel();
        requestNotificationPermission();
        fetchFCMToken();
        setupGoogleSignIn();

        webView.loadUrl("file:///android_asset/index.html");
    }

    private void registerLaunchers() {
        // File chooser
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (filePathCallback == null) return;
                Uri[] results = null;
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    results = new Uri[]{result.getData().getData()};
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        );

        // Google Sign-in
        googleSignInLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> handleGoogleSignInResult(result.getData())
        );

        // Notification permission (Android 13+)
        notificationPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            isGranted -> {
                if (!isGranted) {
                    Toast.makeText(this,
                        "Notification বন্ধ আছে। Settings থেকে চালু করুন।",
                        Toast.LENGTH_LONG).show();
                }
            }
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setGeolocationEnabled(false);
        settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);

        // Security: file:// URLs — only what's needed for assets
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        // These two are dangerous — disabled
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);

        // WebView background purple — load এর আগে white flash দেখাবে না
        webView.setBackgroundColor(android.graphics.Color.parseColor("#4f46e5"));

        // JavaScript Interface
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                sendFCMTokenToWebView();
                handleNotificationIntent(getIntent());
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
                    if (!url.contains("script.google.com")) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        return true;
                    }
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> fcb,
                    FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = fcb;
                try {
                    fileChooserLauncher.launch(params.createIntent());
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage msg) { return true; }

            @Override
            public boolean onJsAlert(WebView v, String url, String msg,
                    android.webkit.JsResult r) { r.cancel(); return true; }

            @Override
            public boolean onJsConfirm(WebView v, String url, String msg,
                    android.webkit.JsResult r) { r.cancel(); return true; }

            @Override
            public boolean onJsPrompt(WebView v, String url, String msg,
                    String def, android.webkit.JsPromptResult r) { r.cancel(); return true; }
        });
    }

    private void setupGoogleSignIn() {
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .requestProfile()
            .build();
        mGoogleSignInClient = GoogleSignIn.getClient(this, gso);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null || webView == null) return;
        String notifUrl    = intent.getStringExtra("notification_url");
        String notifQid    = intent.getStringExtra("notification_qid");
        String notifQsheet = intent.getStringExtra("notification_qsheet");
        if (notifUrl != null && !notifUrl.isEmpty()) {
            String qidStr    = (notifQid    != null && !notifQid.isEmpty())    ? "'" + notifQid    + "'" : "''";
            String qsheetStr = (notifQsheet != null && !notifQsheet.isEmpty()) ? "'" + notifQsheet + "'" : "''";
            String js = "javascript:if(typeof navigateTo==='function'){navigateTo('"
                + notifUrl + "'," + qidStr + "," + qsheetStr + ");}";
            webView.postDelayed(() -> webView.loadUrl(js), 600);
            intent.removeExtra("notification_url");
            intent.removeExtra("notification_qid");
            intent.removeExtra("notification_qsheet");
        }
    }

    private void handleGoogleSignInResult(Intent data) {
        if (webView == null) return;
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            String idToken  = account.getIdToken()      != null ? account.getIdToken()               : "";
            String email    = account.getEmail()         != null ? account.getEmail()                 : "";
            String name     = account.getDisplayName()   != null ? account.getDisplayName()           : "";
            String photoUrl = account.getPhotoUrl()      != null ? account.getPhotoUrl().toString()   : "";
            name  = name.replace("'", "\\'");
            email = email.replace("'", "\\'");
            final String js = "javascript:if(typeof onGoogleSignInResult==='function'){"
                + "onGoogleSignInResult(true,'" + idToken + "','" + email
                + "','" + name + "','" + photoUrl + "');}";
            webView.post(() -> webView.loadUrl(js));
        } catch (ApiException e) {
            Log.e(TAG, "Google Sign-in failed: " + e.getStatusCode());
            webView.post(() -> webView.loadUrl(
                "javascript:if(typeof onGoogleSignInResult==='function'){onGoogleSignInResult(false,'','','','');}"
            ));
        }
    }

    private void fetchFCMToken() {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) return;
                String token = task.getResult();
                getSharedPreferences("FCM", MODE_PRIVATE)
                    .edit().putString("token", token).apply();
            });
    }

    private void sendFCMTokenToWebView() {
        String token = getSharedPreferences("FCM", MODE_PRIVATE).getString("token", "");
        if (!token.isEmpty() && webView != null) {
            webView.loadUrl("javascript:if(typeof onFCMTokenReceived==='function'){onFCMTokenReceived('" + token + "');}");
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "smart_study_channel",
                "Smart Study Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Smart Study থেকে গুরুত্বপূর্ণ notification");
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

    // ════════════════════════════════════════════════════
    //  AndroidBridge — JavaScript Interface
    // ════════════════════════════════════════════════════
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
                    String videoId = url.contains("v=")
                        ? url.split("v=")[1].split("&")[0]
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

        @JavascriptInterface
        public String getFCMToken() {
            return getSharedPreferences("FCM", MODE_PRIVATE).getString("token", "");
        }

        @JavascriptInterface
        public void subscribeToTopic(String topic) {
            FirebaseMessaging.getInstance().subscribeToTopic(topic)
                .addOnCompleteListener(task -> {
                    if (webView != null) {
                        runOnUiThread(() -> webView.loadUrl(
                            "javascript:if(typeof onTopicSubscribed==='function'){onTopicSubscribed('"
                            + topic + "'," + task.isSuccessful() + ");}"
                        ));
                    }
                });
        }

        @JavascriptInterface
        public void unsubscribeFromTopic(String topic) {
            FirebaseMessaging.getInstance().unsubscribeFromTopic(topic);
        }

        @JavascriptInterface
        public void scheduleReminder(String timeStr, String title, String body, int notifId) {
            getSharedPreferences("reminders", MODE_PRIVATE).edit()
                .putString(notifId == 1001 ? "morning_time"  : "night_time",  timeStr)
                .putString(notifId == 1001 ? "morning_title" : "night_title", title)
                .putString(notifId == 1001 ? "morning_body"  : "night_body",  body)
                .apply();
            ReminderHelper.scheduleDaily(MainActivity.this, timeStr, title, body, notifId);
        }

        @JavascriptInterface
        public void cancelReminder(int notifId) {
            ReminderHelper.cancel(MainActivity.this, notifId);
            getSharedPreferences("reminders", MODE_PRIVATE).edit()
                .remove(notifId == 1001 ? "morning_time" : "night_time").apply();
        }

        @JavascriptInterface
        public boolean canScheduleExactAlarms() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                android.app.AlarmManager am = (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
                return am != null && am.canScheduleExactAlarms();
            }
            return true;
        }

        @JavascriptInterface
        public void openAlarmPermissionSettings() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                runOnUiThread(() -> {
                    try {
                        startActivity(new Intent(
                            android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM));
                    } catch (Exception e) {
                        Log.e(TAG, "Cannot open alarm settings", e);
                    }
                });
            }
        }

        @JavascriptInterface
        public void startGoogleSignIn() {
            runOnUiThread(() ->
                mGoogleSignInClient.signOut().addOnCompleteListener(task ->
                    googleSignInLauncher.launch(mGoogleSignInClient.getSignInIntent())
                )
            );
        }

        @JavascriptInterface
        public void signOutGoogle() {
            mGoogleSignInClient.signOut();
        }

        /** WebView screenshot নিয়ে share করো */
        @JavascriptInterface
        public void takeScreenshot() {
            runOnUiThread(() -> {
                try {
                    webView.setDrawingCacheEnabled(true);
                    Bitmap bitmap = Bitmap.createBitmap(webView.getDrawingCache());
                    webView.setDrawingCacheEnabled(false);

                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_PICTURES), "SmartStudy");
                    if (!dir.exists()) dir.mkdirs();
                    File file = new File(dir, "progress_" + System.currentTimeMillis() + ".jpg");

                    FileOutputStream fos = new FileOutputStream(file);
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 90, fos);
                    fos.flush();
                    fos.close();

                    Uri uri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        file
                    );

                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    shareIntent.setType("image/jpeg");
                    shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                    shareIntent.putExtra(Intent.EXTRA_TEXT, "📚 Smart Study — আমার অগ্রগতি দেখো!");
                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(shareIntent, "শেয়ার করো"));
                } catch (Exception e) {
                    Log.e(TAG, "Screenshot failed", e);
                    Toast.makeText(MainActivity.this, "Screenshot নিতে সমস্যা হয়েছে", Toast.LENGTH_SHORT).show();
                }
            });
        }

        /** Plain text share করো */
        @JavascriptInterface
        public void shareText(String text) {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(intent, "শেয়ার করো"));
            });
        }

        /** App version code return করো */
        @JavascriptInterface
        public int getVersionCode() {
            try {
                return getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionCode;
            } catch (Exception e) { return 0; }
        }

        /** App version name return করো */
        @JavascriptInterface
        public String getVersionName() {
            try {
                return getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) { return ""; }
        }
    }

    // ════════════════════════════════════════════════════
    //  Lifecycle
    // ════════════════════════════════════════════════════

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (webView != null) handleNotificationIntent(intent);
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(function(){ if(typeof handleBackPress==='function') return handleBackPress(); return false; })()",
                value -> {
                    if (!"true".equals(value)) {
                        runOnUiThread(() -> moveTaskToBack(true));
                    }
                }
            );
        } else {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        isAppForeground = true;
        if (webView != null) webView.onResume();
        webViewInstance = webView;
    }

    @Override
    protected void onPause() {
        super.onPause();
        isAppForeground = false;
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        webViewInstance = null;
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
    }
}
