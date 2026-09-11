package com.javatutor.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 守卫「404 / 405 不被兜底成 500」。
 *
 * <p>catch-all {@code @ExceptionHandler(Exception.class)} 会把 Spring 6.1 的
 * {@code NoResourceFoundException}（静态资源 404）与 {@code HttpRequestMethodNotSupportedException}
 * （405）一并吞成 500 —— 监控与前端都会把「路径不存在」误读为「服务器故障」。
 * 本用例钉住「按最具体匹配」这条 Spring 语义，防止有人顺手删掉那两个专用 handler。
 */
class GlobalExceptionHandlerTest {

    /** 只用于抛出这几类异常的最小控制器。 */
    @RestController
    static class Probe {

        @GetMapping("/probe/not-found")
        String notFound() throws NoResourceFoundException {
            throw new NoResourceFoundException(HttpMethod.GET, "/no-such-file.js");
        }

        @PostMapping("/probe/only-post")
        String onlyPost() {
            return "ok";
        }

        @GetMapping("/probe/boom")
        String boom() {
            throw new IllegalStateException("boom");
        }
    }

    private MockMvc mvc() {
        return MockMvcBuilders.standaloneSetup(new Probe())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void noResourceFoundStays404Not500() throws Exception {
        mvc().perform(get("/probe/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("not found"));
    }

    @Test
    void wrongMethodStays405Not500() throws Exception {
        mvc().perform(get("/probe/only-post"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("method not allowed"));
    }

    @Test
    void catchAllStillReturns500() throws Exception {
        // 加法不能变减法：新增两个专用 handler 后，兜底那条仍须接住其余异常
        mvc().perform(get("/probe/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("boom"));
    }
}
