package com.javatutor.model;

/** 多文件项目中的一个 Java 源文件（文件名 + 源码） */
public class SourceFile {
    private String name;
    private String code;

    public SourceFile() {
    }

    public SourceFile(String name, String code) {
        this.name = name;
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
