package com.javatutor.controller;

import com.javatutor.model.RunRequest;
import com.javatutor.model.RunResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 端到端验证 RunController.run() 的内联 TRACE_ENGINE_SOURCE 能真实编译并发射图/网络流容器。
 *
 * 背景：compiler/TraceEngine.java 是单测副本，RunController 内联的字符串源码才是
 * 实际运行路径。mvnw test 不会编译该字符串，只有真实调用 run() 才会触发
 * javax.tools 编译——因此必须有这个集成测试来兜底两处源码同步。
 */
class RunControllerTest {

    private final RunController controller = new RunController();

    private static final String DIRECTED_GRAPH = "" +
        "public class DirectedGraph {\n" +
        "    public static void main(String[] args) {\n" +
        "        int n = 6;\n" +
        "        java.util.List<java.util.List<Integer>> adj = new java.util.ArrayList<>();\n" +
        "        for (int i = 0; i < n; i++) adj.add(new java.util.ArrayList<>());\n" +
        "        adj.get(0).add(1); adj.get(0).add(2);\n" +
        "        adj.get(1).add(3);\n" +
        "        adj.get(2).add(3); adj.get(2).add(4);\n" +
        "        adj.get(3).add(5);\n" +
        "        adj.get(4).add(5);\n" +
        "        System.out.println(\"done\");\n" +
        "    }\n" +
        "}\n";

    private static final String UNDIRECTED_GRAPH = "" +
        "public class UndirectedGraph {\n" +
        "    public static void main(String[] args) {\n" +
        "        int n = 6;\n" +
        "        java.util.List<java.util.List<Integer>> adj = new java.util.ArrayList<>();\n" +
        "        for (int i = 0; i < n; i++) adj.add(new java.util.ArrayList<>());\n" +
        "        addEdge(adj, 0, 1); addEdge(adj, 0, 2);\n" +
        "        addEdge(adj, 1, 3); addEdge(adj, 2, 3);\n" +
        "        addEdge(adj, 3, 4); addEdge(adj, 4, 5);\n" +
        "        System.out.println(\"done\");\n" +
        "    }\n" +
        "    static void addEdge(java.util.List<java.util.List<Integer>> adj, int u, int v) {\n" +
        "        adj.get(u).add(v); adj.get(v).add(u);\n" +
        "    }\n" +
        "}\n";

    private static final String MAX_FLOW = "" +
        "public class MaxFlow {\n" +
        "    public static void main(String[] args) {\n" +
        "        int n = 6;\n" +
        "        int[][] capacity = new int[n][n];\n" +
        "        capacity[0][1] = 16; capacity[0][2] = 13;\n" +
        "        capacity[1][3] = 12;\n" +
        "        capacity[2][4] = 14;\n" +
        "        capacity[3][5] = 20;\n" +
        "        capacity[4][5] = 4;\n" +
        "        int source = 0, sink = 5;\n" +
        "        System.out.println(\"done\");\n" +
        "    }\n" +
        "}\n";

    @Test
    void directedGraphShouldEmitDigraphContainer() {
        RunResponse resp = controller.run(new RunRequest(DIRECTED_GRAPH));
        assertTrue(resp.isSuccess(), "运行应成功，实际错误：" + resp.getError());

        Map<String, Object> graph = findLastHeapEntry(resp.getSteps(), "adj$graph");
        assertNotNull(graph, "堆中应存在 adj$graph 图容器");
        assertEquals("Digraph", graph.get("type"));

        Map<String, Object> fields = (Map<String, Object>) graph.get("fields");
        assertNotNull(fields);
        Map<String, Object> adj = (Map<String, Object>) fields.get("adj");
        assertNotNull(adj);
        // 有向：0 -> 1, 2
        assertEquals(2, ((List<?>) adj.get("0")).size());
    }

    @Test
    void undirectedGraphShouldEmitGraphContainer() {
        RunResponse resp = controller.run(new RunRequest(UNDIRECTED_GRAPH));
        assertTrue(resp.isSuccess(), "运行应成功，实际错误：" + resp.getError());

        Map<String, Object> graph = findLastHeapEntry(resp.getSteps(), "adj$graph");
        assertNotNull(graph, "堆中应存在 adj$graph 图容器");
        assertEquals("Graph", graph.get("type"));
    }

    @Test
    void maxFlowShouldEmitMaxFlowContainer() {
        RunResponse resp = controller.run(new RunRequest(MAX_FLOW));
        assertTrue(resp.isSuccess(), "运行应成功，实际错误：" + resp.getError());

        Map<String, Object> graph = findLastHeapEntry(resp.getSteps(), "capacity$graph");
        assertNotNull(graph, "堆中应存在 capacity$graph 网络流容器");
        assertEquals("MaxFlow", graph.get("type"));

        Map<String, Object> fields = (Map<String, Object>) graph.get("fields");
        assertNotNull(fields);

        Map<String, Object> cap = (Map<String, Object>) fields.get("capacity");
        assertNotNull(cap, "fields 应包含 capacity 容量矩阵");
        assertEquals(16, ((Map<?, ?>) cap.get("0")).get("1"));

        assertEquals("0", fields.get("source"));
        assertEquals("5", fields.get("sink"));
    }

    /** 从后往前找第一个包含指定堆键的快照，返回该堆条目（即最终状态）。 */
    private Map<String, Object> findLastHeapEntry(List<Map<String, Object>> steps, String key) {
        for (int i = steps.size() - 1; i >= 0; i--) {
            Map<String, Object> heap = (Map<String, Object>) steps.get(i).get("heap");
            if (heap != null && heap.get(key) instanceof Map) {
                return (Map<String, Object>) heap.get(key);
            }
        }
        return null;
    }
}
