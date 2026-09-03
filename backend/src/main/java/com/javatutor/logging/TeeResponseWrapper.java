package com.javatutor.logging;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

/**
 * 响应体「边写边采」包装器：写向原始响应流的同时，把内容复制一份到内存缓冲，
 * 供访问日志在请求结束时读取。对 SSE 流式响应同样保持实时（字节即时透传），
 * 只额外做一份有上限的采样，不影响流式推送。
 *
 * <p>捕获有字节数上限（{@code maxBytes}），但 {@link #getTotalBytes()} 仍统计
 * 真实写出的字节数，用于记录准确的 {@code respBytes}。
 */
public class TeeResponseWrapper extends HttpServletResponseWrapper {

    private final int maxBytes;
    private final ByteArrayOutputStream capture = new ByteArrayOutputStream();
    private final StringBuilder writerCapture = new StringBuilder();

    private long totalBytes = 0;
    private ServletOutputStream teeStream;
    private PrintWriter teeWriter;
    private boolean streamUsed = false;
    private boolean writerUsed = false;

    public TeeResponseWrapper(HttpServletResponse response, int maxBytes) {
        super(response);
        this.maxBytes = maxBytes;
    }

    @Override
    public ServletOutputStream getOutputStream() throws IOException {
        if (writerUsed) {
            throw new IllegalStateException("getWriter() 已被调用，不能再调用 getOutputStream()");
        }
        if (teeStream == null) {
            teeStream = new TeeServletOutputStream(super.getOutputStream());
            streamUsed = true;
        }
        return teeStream;
    }

    @Override
    public PrintWriter getWriter() throws IOException {
        if (streamUsed) {
            throw new IllegalStateException("getOutputStream() 已被调用，不能再调用 getWriter()");
        }
        if (teeWriter == null) {
            teeWriter = new TeePrintWriter(super.getWriter());
            writerUsed = true;
        }
        return teeWriter;
    }

    /** 已采样捕获的响应体（字节）；若走 writer 路径则按 UTF-8 编码返回。 */
    public byte[] getCapturedBody() {
        if (writerUsed) {
            return writerCapture.toString().getBytes(StandardCharsets.UTF_8);
        }
        return capture.toByteArray();
    }

    /** 真实写出的字节数（含被截断未采样的部分）。 */
    public long getTotalBytes() {
        return totalBytes;
    }

    /** 是否为 SSE 流式响应（按 Content-Type 判断）。 */
    public boolean isStreamed() {
        String ct = getContentType();
        return ct != null && ct.toLowerCase().contains("text/event-stream");
    }

    private final class TeeServletOutputStream extends ServletOutputStream {
        private final ServletOutputStream delegate;

        TeeServletOutputStream(ServletOutputStream delegate) {
            this.delegate = delegate;
        }

        @Override
        public boolean isReady() {
            return delegate.isReady();
        }

        @Override
        public void setWriteListener(WriteListener listener) {
            delegate.setWriteListener(listener);
        }

        @Override
        public void write(int b) throws IOException {
            delegate.write(b);
            totalBytes++;
            if (capture.size() < maxBytes) {
                capture.write(b);
            }
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            delegate.write(b, off, len);
            totalBytes += len;
            int remaining = maxBytes - capture.size();
            if (remaining > 0) {
                capture.write(b, off, Math.min(len, remaining));
            }
        }

        @Override
        public void flush() throws IOException {
            delegate.flush();
        }

        @Override
        public void close() throws IOException {
            delegate.close();
        }
    }

    private final class TeePrintWriter extends PrintWriter {
        private final PrintWriter delegate;

        TeePrintWriter(PrintWriter delegate) {
            super(delegate);
            this.delegate = delegate;
        }

        @Override
        public void write(int c) {
            delegate.write(c);
            totalBytes++;
            if (writerCapture.length() < maxBytes) {
                writerCapture.append((char) c);
            }
        }

        @Override
        public void write(char[] buf, int off, int len) {
            delegate.write(buf, off, len);
            totalBytes += len;
            appendCapture(buf, off, len);
        }

        @Override
        public void write(String s, int off, int len) {
            delegate.write(s, off, len);
            totalBytes += len;
            appendCapture(s.toCharArray(), off, len);
        }

        private void appendCapture(char[] buf, int off, int len) {
            int remaining = maxBytes - writerCapture.length();
            if (remaining > 0) {
                writerCapture.append(new String(buf, off, Math.min(len, remaining)));
            }
        }
    }
}
