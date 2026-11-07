package be.sportgreenmoove.app.ui;

import org.junit.runner.Description;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

public final class OrdinaryCaseTimingChecks {
    private OrdinaryCaseTimingChecks() {}
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    public static void main(String[] arguments) {
        AtomicLong clock = new AtomicLong(1234);
        ArrayList<Map<String, Object>> rows = new ArrayList<>();
        OrdinaryCaseTimingListener listener = new OrdinaryCaseTimingListener(clock::get, rows::add);
        Description first = Description.createTestDescription("PRIVATE_CLASS", "PRIVATE_METHOD");
        Description second = Description.createTestDescription("OTHER_PRIVATE_CLASS", "OTHER_PRIVATE_METHOD");
        listener.testStarted(first); clock.addAndGet(450); listener.testFinished(first);
        clock.addAndGet(20); listener.testIgnored(second);
        check(rows.size() == 3, "Callback multiplicity changed");
        check(rows.get(0).get("event").equals("started") && rows.get(1).get("event").equals("finished"), "Callback order changed");
        check(rows.get(1).get("elapsedMs").equals(450L) && rows.get(2).get("elapsedMs").equals(470L), "Monotonic elapsed time changed");
        check(rows.get(0).get("caseSha256").equals(rows.get(1).get("caseSha256")), "Same case changed identity");
        check(!rows.get(0).get("caseSha256").equals(rows.get(2).get("caseSha256")), "Different cases share identity");
        for (int index = 0; index < rows.size(); index++) {
            Map<String, Object> row = rows.get(index);
            check(row.get("sequence").equals(index + 1), "Sequence changed");
            check(row.get("scope").equals(OrdinaryCaseTimingListener.SCOPE), "Diagnostic scope changed");
            check(row.get("caseSha256").toString().matches("[a-f0-9]{64}"), "Identity is not a SHA-256 fingerprint");
            check(!row.toString().contains("PRIVATE"), "Raw test identity escaped");
            try { row.put("foreign", true); throw new AssertionError("Record is mutable"); }
            catch (UnsupportedOperationException expected) { check(!row.containsKey("foreign"), "Record was mutated"); }
        }
        for (int index = 0; index < 2000; index++) listener.testStarted(first);
        check(rows.size() == OrdinaryCaseTimingListener.MAX_EVENTS + 1, "Fixed event budget changed");
        check(rows.get(rows.size() - 1).get("event").equals("limit-reached"), "Truncation was not explicit");
        check(rows.stream().noneMatch(row -> row.containsKey("passed") || row.containsKey("failed") || row.containsKey("result")), "Timing accepted a test result");
        System.out.println("Ordinary timing checks passed: actual listener compiled against Android and JUnit; injected clock/logger only; callback order, hashed identity, elapsed time, immutable records and 1025-event cap; no device emission proof.");
    }
}
