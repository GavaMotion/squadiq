/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.gavamotion.squadiq;

import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    // Where the install came from. The marketing site tags its Play Store link
    // with &referrer=utm_source=...; Play keeps that through the install and
    // hands it over once, here. On the first launch only, wait (briefly) for it
    // and open the web app with the tags in the URL, where src/lib/attribution.js
    // picks them up exactly as it does for a tagged web visit.
    private static final String PREFS = "squadiq_install";
    private static final String KEY_READ = "install_referrer_read";
    private static final long REFERRER_WAIT_MS = 1000;
    private static final String[] UTM = {"utm_source", "utm_medium", "utm_campaign", "utm_content", "sq_ref"};

    private String mInstallReferrer;
    private boolean mLaunchStarted;

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        return prefs().getBoolean(KEY_READ, false);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }

        if (isFinishing() || shouldLaunchImmediately()) return;
        readInstallReferrerThenLaunch();
    }

    private void readInstallReferrerThenLaunch() {
        // Never hold the coach on the splash screen for attribution: whichever
        // comes first, the referrer or the timeout, launches the app.
        new Handler(Looper.getMainLooper()).postDelayed(() -> launchWithReferrer(null), REFERRER_WAIT_MS);
        try {
            InstallReferrerClient client = InstallReferrerClient.newBuilder(this).build();
            client.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int responseCode) {
                    String referrer = null;
                    if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                        try {
                            referrer = client.getInstallReferrer().getInstallReferrer();
                        } catch (Exception e) {
                            // No referrer is fine: the app just opens untagged.
                        }
                    }
                    try { client.endConnection(); } catch (Exception e) { /* already gone */ }
                    String found = referrer;
                    runOnUiThread(() -> launchWithReferrer(found));
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    runOnUiThread(() -> launchWithReferrer(null));
                }
            });
        } catch (Exception e) {
            // Play Store missing or too old (sideloads, some Chromebooks).
            launchWithReferrer(null);
        }
    }

    private void launchWithReferrer(String referrer) {
        if (mLaunchStarted || isFinishing() || isDestroyed()) return;
        mLaunchStarted = true;
        mInstallReferrer = referrer;
        // Read once per install. A later launch from an ad must not re-credit it.
        prefs().edit().putBoolean(KEY_READ, true).apply();
        launchTwa();
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();
        if (mInstallReferrer == null || mInstallReferrer.isEmpty()) return uri;

        // The referrer is itself a query string: "utm_source=reddit&utm_medium=paid&...".
        Uri tags = Uri.parse("https://x/?" + mInstallReferrer);
        Uri.Builder b = uri.buildUpon();
        String source = tags.getQueryParameter("utm_source");
        if (source == null || "google-play".equals(source)) {
            // An install that didn't come through a tagged link: Play reports it as
            // google-play / organic. Pass it as a referrer, not as campaign tags, so
            // attribution.js only uses it when nothing is stored, and a coach who
            // first came from an ad and then found the app in the store keeps the ad.
            String ref = tags.getQueryParameter("sq_ref");
            b.appendQueryParameter("sq_ref", ref != null && !ref.isEmpty() ? ref : "play.google.com");
            return b.build();
        }
        for (String key : UTM) {
            String v = tags.getQueryParameter(key);
            // Play fills untagged fields with "(not set)" or "(not%20set)".
            if (v != null && !v.isEmpty() && !v.startsWith("(not")) b.appendQueryParameter(key, v);
        }
        return b.build();
    }
}
