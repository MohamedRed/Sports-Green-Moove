package be.sportgreenmoove.app.ui;

import android.os.SystemClock;
import android.util.Log;
import org.json.JSONObject;
import org.junit.runner.Description;
import org.junit.runner.notification.RunListener;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.LongSupplier;

/** Diagnostic callbacks only: never classify, retry, reorder or finish a test. */
public final class OrdinaryCaseTimingListener extends RunListener {
    static final String TAG = "SGMOrdinaryTiming";
    static final String SCOPE = "ordinary-case-clock-observation-not-result-or-cause-proof";
    static final int MAX_EVENTS = 1024;
    private final LongSupplier clock;
    private final Consumer<Map<String, Object>> publish;
    private final long startedAt;
    private int sequence;
    private boolean capped;

    public OrdinaryCaseTimingListener() {
        this(SystemClock::elapsedRealtime, row -> Log.i(TAG, new JSONObject(row).toString()));
    }

    OrdinaryCaseTimingListener(LongSupplier clock, Consumer<Map<String, Object>> publish) {
        this.clock = clock;
        this.publish = publish;
        this.startedAt = clock.getAsLong();
    }

    @Override public void testStarted(Description description) { record("started", description); }
    @Override public void testFinished(Description description) { record("finished", description); }
    @Override public void testIgnored(Description description) { record("ignored", description); }

    private synchronized void record(String event, Description description) {
        if (capped) return;
        if (sequence == MAX_EVENTS) { capped = true; event = "limit-reached"; }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("schemaVersion", 1);
        row.put("scope", SCOPE);
        row.put("sequence", ++sequence);
        row.put("event", event);
        row.put("elapsedMs", clock.getAsLong() - startedAt);
        row.put("caseSha256", identity(description));
        publish.accept(Collections.unmodifiableMap(row));
    }

    private static String identity(Description description) {
        String value = String.valueOf(description.getClassName()) + "\u0000" + String.valueOf(description.getMethodName());
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(64);
            for (byte part : digest) {
                result.append(Character.forDigit((part >>> 4) & 15, 16));
                result.append(Character.forDigit(part & 15, 16));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new AssertionError("Required SHA-256 implementation unavailable", impossible);
        }
    }
}
