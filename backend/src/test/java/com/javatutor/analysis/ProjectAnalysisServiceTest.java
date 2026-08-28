package com.javatutor.analysis;

import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 多文件静态分析子系统单元测试：
 * 入口解析、三张图生成、失败文件隔离、规模校验。
 */
class ProjectAnalysisServiceTest {

    @Test
    void testAnalyzeSimpleProject() {
        List<Map<String, Object>> files = List.of(
            file("src/Main.java",
                "package demo;\n" +
                "public class Main {\n" +
                "  public static void main(String[] args) {\n" +
                "    Service s = new Service();\n" +
                "    int r = s.run(1);\n" +
                "    if (r > 0) { System.out.println(r); }\n" +
                "  }\n" +
                "}\n"),
            file("src/Service.java",
                "package demo;\n" +
                "public class Service {\n" +
                "  public int run(int x) {\n" +
                "    for (int i = 0; i < x; i++) { x += i; }\n" +
                "    return x;\n" +
                "  }\n" +
                "}\n")
        );

        ProjectAnalysisService svc = new ProjectAnalysisService();
        Map<String, Object> result = svc.analyze(files);

        // 入口
        @SuppressWarnings("unchecked")
        Map<String, Object> entry = (Map<String, Object>) result.get("entry");
        assertEquals("demo.Main", entry.get("class"));
        assertEquals("main", entry.get("method"));

        // 流程图
        @SuppressWarnings("unchecked")
        Map<String, Object> flow = (Map<String, Object>) result.get("flow");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> classes = (List<Map<String, Object>>) flow.get("classes");
        assertEquals(2, classes.size());

        // 类图
        @SuppressWarnings("unchecked")
        Map<String, Object> cd = (Map<String, Object>) result.get("classDiagram");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cdClasses = (List<Map<String, Object>>) cd.get("classes");
        assertEquals(2, cdClasses.size());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> relations = (List<Map<String, Object>>) cd.get("relations");
        // Main 依赖 Service（depends_on）
        assertTrue(relations.stream().anyMatch(r ->
            "demo.Main".equals(r.get("from")) && "demo.Service".equals(r.get("to"))
                && "depends_on".equals(r.get("type"))));

        // 结构图
        @SuppressWarnings("unchecked")
        Map<String, Object> structure = (Map<String, Object>) result.get("structure");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> packages = (List<Map<String, Object>>) structure.get("packages");
        assertEquals(1, packages.size());
        assertEquals("demo", packages.get(0).get("id"));

        // 调用关系图
        @SuppressWarnings("unchecked")
        Map<String, Object> cg = (Map<String, Object>) result.get("callGraph");
        assertNotNull(cg, "callGraph 不应为 null");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cgClasses = (List<Map<String, Object>>) cg.get("classes");
        assertEquals(2, cgClasses.size());
        System.out.println("=== callGraph ===" + cg);

        // 无错误
        @SuppressWarnings("unchecked")
        List<Map<String, String>> errors = (List<Map<String, String>>) result.get("errors");
        assertTrue(errors.isEmpty());
    }

    @Test
    void testBrokenFileIsolated() {
        List<Map<String, Object>> files = List.of(
            file("ok.java", "public class Ok { public void m() { int a = 1; } }"),
            file("broken.java", "public class Broken { this is not java !!!")
        );
        ProjectAnalysisService svc = new ProjectAnalysisService();
        Map<String, Object> result = svc.analyze(files);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> errors = (List<Map<String, String>>) result.get("errors");
        assertEquals(1, errors.size());
        assertEquals("broken.java", errors.get(0).get("path"));

        // 成功文件仍出图
        @SuppressWarnings("unchecked")
        Map<String, Object> cd = (Map<String, Object>) result.get("classDiagram");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cdClasses = (List<Map<String, Object>>) cd.get("classes");
        assertEquals(1, cdClasses.size());
    }

    @Test
    void testEntryFallbackToFirstClass() {
        // 无 main 方法，回退到第一个可解析类的第一个方法
        List<Map<String, Object>> files = List.of(
            file("A.java", "public class A { public void foo() { int x = 1; } }")
        );
        ProjectAnalysisService svc = new ProjectAnalysisService();
        Map<String, Object> result = svc.analyze(files);

        @SuppressWarnings("unchecked")
        Map<String, Object> entry = (Map<String, Object>) result.get("entry");
        assertEquals("A", entry.get("class"));
        assertEquals("foo", entry.get("method"));
    }

    @Test
    void testSizeLimitExceeded() {
        List<Map<String, Object>> files = new ArrayList<>();
        for (int i = 0; i < ProjectAnalysisService.MAX_FILES + 1; i++) {
            files.add(file("f" + i + ".java", "public class C" + i + " {}"));
        }
        ProjectAnalysisService svc = new ProjectAnalysisService();
        Map<String, Object> result = svc.analyze(files);
        assertFalse((Boolean) result.get("success"));
        assertTrue(String.valueOf(result.get("error")).contains("50"));
    }

    private Map<String, Object> file(String path, String code) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("path", path);
        f.put("code", code);
        return f;
    }
}
