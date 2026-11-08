package com.tantanasuite.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.*;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.*;
import android.support.customtabs.ICustomTabsCallback;
import android.support.customtabs.ICustomTabsService;
import java.util.ArrayList;
import java.util.Collections;

/** Confie le SaaS au navigateur de l’appareil dans une Trusted Web Activity. */
public final class TantanaActivity extends Activity {
    private static final Uri SITE = Uri.parse("https://tantana-suite.com/");
    private static final String SERVICE = "android.support.customtabs.action.CustomTabsService";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean bound;
    private boolean launched;

    private final ICustomTabsCallback.Stub session = new ICustomTabsCallback.Stub() {
        public void onNavigationEvent(int event, Bundle extras) {}
        public void extraCallback(String name, Bundle args) {}
        public Bundle extraCallbackWithResult(String name, Bundle args) { return null; }
        public void onMessageChannelReady(Bundle extras) {}
        public void onPostMessage(String message, Bundle extras) {}
        public void onRelationshipValidationResult(int relation, Uri origin, boolean result, Bundle extras) {}
    };

    private final ServiceConnection connection = new ServiceConnection() {
        public void onServiceConnected(ComponentName name, IBinder binder) {
            if (launched || isFinishing()) return;
            try {
                ICustomTabsService service = ICustomTabsService.Stub.asInterface(binder);
                service.warmup(0);
                if (service.newSession(session)) {
                    Intent app = new Intent(Intent.ACTION_VIEW, SITE).setPackage(name.getPackageName());
                    Bundle extras = new Bundle();
                    extras.putBinder("android.support.customtabs.extra.SESSION", session);
                    app.putExtras(extras);
                    android.util.TypedValue surface = new android.util.TypedValue();
                    getTheme().resolveAttribute(android.R.attr.colorBackground, surface, true);
                    app.putExtra("android.support.customtabs.extra.TOOLBAR_COLOR", surface.data);
                    app.putExtra("android.support.customtabs.extra.LAUNCH_AS_TRUSTED_WEB_ACTIVITY", true);
                    app.putStringArrayListExtra("android.support.customtabs.extra.ADDITIONAL_TRUSTED_ORIGINS",
                        new ArrayList<>(Collections.singletonList("https://www.tantana-suite.com")));
                    launch(app);
                    return;
                }
            } catch (RemoteException | ActivityNotFoundException | SecurityException unavailable) {
                // Un navigateur peut être désactivé ou mis à jour pendant le lancement.
            }
            openWebsite();
        }
        public void onServiceDisconnected(ComponentName name) { openWebsite(); }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        launched = state != null && state.getBoolean("launched");
        if (launched) return;
        Intent service = new Intent(SERVICE);
        ResolveInfo browser = getPackageManager().resolveActivity(new Intent(Intent.ACTION_VIEW, SITE),
            android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
        if (browser != null) service.setPackage(browser.activityInfo.packageName);
        ResolveInfo provider = getPackageManager().resolveService(service, 0);
        if (provider == null) provider = getPackageManager().resolveService(new Intent(SERVICE), 0);
        if (provider != null) {
            service.setPackage(provider.serviceInfo.packageName);
            try { bound = bindService(service, connection, BIND_AUTO_CREATE); }
            catch (SecurityException unavailable) { bound = false; }
        }
        if (bound) handler.postDelayed(this::openWebsite, 3000);
        else openWebsite();
    }

    private void launch(Intent intent) {
        startActivityForResult(intent, 1);
        launched = true;
        handler.removeCallbacksAndMessages(null);
    }

    private void openWebsite() {
        if (launched || isFinishing() || isDestroyed()) return;
        try { launch(new Intent(Intent.ACTION_VIEW, SITE)); }
        catch (ActivityNotFoundException unavailable) {
            launched = true;
            new AlertDialog.Builder(this).setMessage("Activez un navigateur pour ouvrir Tantana.")
                .setPositiveButton(android.R.string.ok, (dialog, which) -> finish())
                .setOnCancelListener(dialog -> finish()).show();
        }
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putBoolean("launched", launched);
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 1) finish();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (bound) unbindService(connection);
        super.onDestroy();
    }
}
