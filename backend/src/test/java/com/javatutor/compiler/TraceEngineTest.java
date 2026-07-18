package com.javatutor.compiler;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class TraceEngineTest {

    private final PrintStream originalOut = System.out;
    private ByteArrayOutputStream systemOut;

    @BeforeEach
    void setUp() {
        TraceEngine.reset();
        systemOut = new ByteArrayOutputStream();
        System.setOut(new PrintStream(systemOut, true));
    }

    @AfterEach
    void tearDown() {
        System.setOut(originalOut);
    }

    @Test
    void recordShouldCaptureStepAndLine() {
        TraceEngine.record(1, 5, Map.of("x", 10));
        List<Map<String, Object>> steps = TraceEngine.getSteps();
        assertEquals(1, steps.size());
        assertEquals(1, steps.get(0).get("step"));
        assertEquals(5, steps.get(0).get("line"));
    }

    @Test
    void recordShouldCaptureVariables() {
        Map<String, Object> vars = new HashMap<>();
        vars.put("a", 1);
        vars.put("b", "hello");
        vars.put("c", null);
        TraceEngine.record(10, 3, vars);
        Map<String, Object> captured = (Map<String, Object>) TraceEngine.getSteps().get(0).get("variables");
        assertEquals(1, captured.get("a"));
        assertEquals("hello", captured.get("b"));
        assertNull(captured.get("c"));
    }

    @Test
    void resetShouldClearAllState() {
        TraceEngine.record(0, 1, Map.of("x", 1));
        assertFalse(TraceEngine.getSteps().isEmpty());
        TraceEngine.reset();
        assertTrue(TraceEngine.getSteps().isEmpty());
    }

    @Test
    void disableShouldStopRecording() {
        TraceEngine.disable();
        TraceEngine.record(0, 1, Map.of("x", 1));
        assertTrue(TraceEngine.getSteps().isEmpty());
    }

    @Test
    void resetShouldReEnableRecording() {
        TraceEngine.disable();
        TraceEngine.record(0, 1, Map.of("x", 1));
        assertTrue(TraceEngine.getSteps().isEmpty());
        TraceEngine.reset();
        TraceEngine.record(0, 1, Map.of("x", 1));
        assertFalse(TraceEngine.getSteps().isEmpty());
    }

    @Test
    void multipleRecordsShouldAccumulate() {
        TraceEngine.record(0, 1, Map.of("a", 1));
        TraceEngine.record(1, 2, Map.of("a", 2));
        TraceEngine.record(2, 3, Map.of("a", 3));
        assertEquals(3, TraceEngine.getSteps().size());
    }

    @Test
    void recordShouldIncludeHeapSnapshot() {
        TraceEngine.record(0, 1, Map.of("x", 1));
        Map<String, Object> step = TraceEngine.getSteps().get(0);
        assertTrue(step.containsKey("heap"));
    }

    @Test
    void pushFrameShouldNotThrow() {
        TraceEngine.pushFrame("main");
        TraceEngine.record(0, 1, Map.of());
        assertNotNull(TraceEngine.getSteps().get(0));
    }

    @Test
    void pushPopFrameShouldMaintainStackDepth() {
        TraceEngine.pushFrame("main");
        TraceEngine.pushFrame("helper");
        String popped = TraceEngine.popFrame();
        assertEquals("helper", popped);
        popped = TraceEngine.popFrame();
        assertEquals("main", popped);
    }

    @Test
    void popFrameOnEmptyStackShouldNotThrow() {
        assertEquals("???", TraceEngine.popFrame());
    }

    @Test
    void pushFrameWithParamsShouldStoreArgs() {
        TraceEngine.pushFrame("add", "a", 3, "b", 5);
        String popped = TraceEngine.popFrame();
        assertEquals("add", popped);
    }

    @Test
    void frameLocalsShouldBeCapturedInStep() {
        TraceEngine.pushFrame("main");
        TraceEngine.record(0, 1, TraceEngine.buildMap("x", 1));
        TraceEngine.record(1, 2, TraceEngine.buildMap("x", 2));
        TraceEngine.popFrame();
        Map<String, Object> vars0 = (Map<String, Object>) TraceEngine.getSteps().get(0).get("variables");
        assertEquals(1, vars0.get("x"));
        Map<String, Object> vars1 = (Map<String, Object>) TraceEngine.getSteps().get(1).get("variables");
        assertEquals(2, vars1.get("x"));
    }

    @Test
    void allocObjectShouldCreateHeapEntry() {
        String id = TraceEngine.allocObject("obj", "just a test");
        assertNotNull(id);
        assertTrue(id.startsWith("0x"));
    }

    @Test
    void allocArrayShouldCreateHeapEntry() {
        String id = TraceEngine.allocArray("arr", 5);
        assertNotNull(id);
        assertTrue(id.startsWith("0x"));
    }

    @Test
    void recordWithComplexObjectShouldStoreHeapReference() {
        TraceEngine.record(0, 1, Map.of("myObj", createPlainObject()));
        Map<String, Object> vars = (Map<String, Object>) TraceEngine.getSteps().get(0).get("variables");
        Object v = vars.get("myObj");
        assertTrue(v instanceof String && ((String) v).startsWith("0x"),
            "complex object should be replaced with heap ID, got: " + v);
    }

    @Test
    void recordWithArrayShouldCopyElements() {
        int[] arr = {1, 2, 3};
        TraceEngine.record(0, 1, Map.of("arr", arr));
        Map<String, Object> vars = (Map<String, Object>) TraceEngine.getSteps().get(0).get("variables");
        List<Object> copy = (List<Object>) vars.get("arr");
        assertNotNull(copy);
        assertEquals(3, copy.size());
        assertEquals(1, copy.get(0));
        assertEquals(3, copy.get(2));
    }

    @Test
    void recordWithNestedArrayShouldDeepCopy() {
        int[][] matrix = {{1, 2}, {3, 4}};
        TraceEngine.record(0, 1, Map.of("matrix", matrix));
        Map<String, Object> vars = (Map<String, Object>) TraceEngine.getSteps().get(0).get("variables");
        List<Object> outer = (List<Object>) vars.get("matrix");
        assertNotNull(outer);
        assertEquals(2, outer.size());
        assertTrue(outer.get(0) instanceof List);
    }

    @Test
    void setOutputStreamShouldCaptureOutput() {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        TraceEngine.setOutputStream(baos);
        PrintStream ps = new PrintStream(baos, true);
        ps.println("hello");
        TraceEngine.record(0, 1, Map.of());
        Map<String, Object> step = TraceEngine.getSteps().get(0);
        assertTrue(step.containsKey("output"));
        String output = (String) step.get("output");
        assertTrue(output.contains("hello"));
    }

    @Test
    void outputCaptureShouldAccumulateAcrossSteps() {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        TraceEngine.setOutputStream(baos);
        PrintStream ps = new PrintStream(baos, true);
        ps.print("first");
        TraceEngine.record(0, 1, Map.of());
        ps.print("second");
        TraceEngine.record(1, 2, Map.of());
        assertEquals("first", TraceEngine.getSteps().get(0).get("output"));
        assertEquals("second", TraceEngine.getSteps().get(1).get("output"));
    }

    @Test
    void buildMapWithEvenArgsShouldCreateCorrectMap() {
        Map<String, Object> m = TraceEngine.buildMap("a", 1, "b", "two", "c", 3.0);
        assertEquals(3, m.size());
        assertEquals(1, m.get("a"));
        assertEquals("two", m.get("b"));
        assertEquals(3.0, m.get("c"));
    }

    @Test
    void buildMapShouldPreserveInsertionOrder() {
        Map<String, Object> m = TraceEngine.buildMap("z", 1, "a", 2, "m", 3);
        List<String> keys = new ArrayList<>(m.keySet());
        assertEquals("z", keys.get(0));
        assertEquals("a", keys.get(1));
        assertEquals("m", keys.get(2));
    }

    @Test
    void buildMapWithEmptyArgsShouldReturnEmptyMap() {
        Map<String, Object> m = TraceEngine.buildMap();
        assertTrue(m.isEmpty());
    }

    @Test
    void recordWithEmptyVariablesShouldNotThrow() {
        TraceEngine.record(0, 1, Collections.emptyMap());
        assertEquals(1, TraceEngine.getSteps().size());
    }

    @Test
    void multipleResetsShouldBeSafe() {
        TraceEngine.reset();
        TraceEngine.reset();
        TraceEngine.reset();
        assertTrue(TraceEngine.getSteps().isEmpty());
    }

    @Test
    void recordWithArrayListShouldCopyToList() {
        List<String> list = new ArrayList<>(Arrays.asList("a", "b", "c"));
        TraceEngine.record(0, 1, Map.of("list", list));
        Map<String, Object> vars = (Map<String, Object>) TraceEngine.getSteps().get(0).get("variables");
        List<Object> copy = (List<Object>) vars.get("list");
        assertNotNull(copy);
        assertEquals(3, copy.size());
        assertEquals("a", copy.get(0));
    }

    @Test
    void recordWithHashMapShouldCopyToMap() {
        Map<String, Integer> map = new LinkedHashMap<>();
        map.put("key1", 100);
        map.put("key2", 200);
        TraceEngine.record(0, 1, Map.of("map", map));
        Map<String, Object> vars = (Map<String, Object>) TraceEngine.getSteps().get(0).get("variables");
        assertTrue(vars.get("map") instanceof Map);
    }
    /** Simple custom class (non-java.*) to test heap reference behavior. */
    static class HeapTestObj {
        int value = 42;
    }

    /** Creates a simple object with no enclosing reference for heap tests. */
    private static Object createPlainObject() {
        return new HeapTestObj();
    }

}