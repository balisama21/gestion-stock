package com.tantanasuite.app;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import org.json.*;
import java.util.Calendar;

/** Android conserve les alarmes quand la WebView et son processus sont fermés. */
public final class RappelsAndroid extends BroadcastReceiver {
    static final String CHANNEL = "rappels";
    private static final String FIRE = "com.tantanasuite.app.RAPPEL";
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(CHANNEL, 0); }

    static boolean exact(Context c) {
        return Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    static boolean notifications(Context c) {
        NotificationManager manager = c.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Rappels d’organisation", NotificationManager.IMPORTANCE_HIGH));
        return manager.areNotificationsEnabled() && manager.getNotificationChannel(CHANNEL).getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    private static JSONArray rules(Context c) throws JSONException {
        return new JSONArray(prefs(c).getString("rules", "[]"));
    }

    private static PendingIntent alarm(Context c, String id, long due) {
        Intent intent = new Intent(c, RappelsAndroid.class).setAction(FIRE)
            .setData(new Uri.Builder().scheme("tantana").authority("rappel").appendPath(id).build())
            .putExtra("due", due);
        return PendingIntent.getBroadcast(c, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancel(Context c) throws JSONException {
        JSONArray old = rules(c);

        AlarmManager manager = c.getSystemService(AlarmManager.class);
        for (int i = 0; i < old.length(); i++)
            manager.cancel(alarm(c, old.getJSONObject(i).getString("id"), 0));
    }

    static void replace(Context c, JSONArray rows) throws JSONException {
        if (rules(c).toString().equals(rows.toString())) return;
        cancel(c);
        prefs(c).edit().putString("rules", rows.toString()).apply();
        scheduleAll(c);
    }

    static void scheduleAll(Context c) throws JSONException {
        if (!prefs(c).getBoolean("enabled", false) || !notifications(c) || !exact(c)) return;
        JSONArray rows = rules(c);
        for (int i = 0; i < rows.length(); i++) schedule(c, rows.getJSONObject(i), System.currentTimeMillis());
    }

    private static void schedule(Context c, JSONObject row, long now) throws JSONException {
        String kind = row.getString("recurrence");
        long due = row.optLong("time", 0);
        if (!"aucune".equals(kind)) {
            Calendar day = Calendar.getInstance();
            day.setTimeInMillis(now);
            day.set(Calendar.HOUR_OF_DAY, row.getInt("hour"));
            day.set(Calendar.MINUTE, row.getInt("minute"));
            day.set(Calendar.SECOND, 0);
            day.set(Calendar.MILLISECOND, 0);
            for (int i = 0; i < 64; i++, day.add(Calendar.DATE, 1)) {
                boolean match = "quotidien".equals(kind)
                    || ("hebdomadaire".equals(kind) && day.get(Calendar.DAY_OF_WEEK) - 1 == row.optInt("weekday"))
                    || ("mensuel".equals(kind) && day.get(Calendar.DAY_OF_MONTH) == row.optInt("monthday"));
                if (match && day.getTimeInMillis() > now) { due = day.getTimeInMillis(); break; }
            }
        }
        if (due > now) c.getSystemService(AlarmManager.class).setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP, due, alarm(c, row.getString("id"), due));
    }

    @Override public void onReceive(Context c, Intent intent) {
        try {
            if (!FIRE.equals(intent.getAction())) { scheduleAll(c); return; }
            if (!prefs(c).getBoolean("enabled", false) || !notifications(c) || intent.getData() == null) return;
            JSONArray rows = rules(c);
            String id = intent.getData().getLastPathSegment();
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i);
                if (!row.getString("id").equals(id)) continue;
                PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, EcranTantana.class), PendingIntent.FLAG_IMMUTABLE);
                Notification notification = new Notification.Builder(c, CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_popup_reminder)
                    .setContentTitle("Tantana · Rappel").setContentText(row.getString("title"))
                    .setVisibility(Notification.VISIBILITY_PRIVATE).setAutoCancel(true).setContentIntent(open).build();
                c.getSystemService(NotificationManager.class).notify(id, 1, notification);
                if (exact(c)) schedule(c, row, Math.max(System.currentTimeMillis(), intent.getLongExtra("due", 0)));
                break;
            }
        } catch (JSONException | SecurityException e) { android.util.Log.w("Tantana", "Rappel indisponible", e); }
    }
}
