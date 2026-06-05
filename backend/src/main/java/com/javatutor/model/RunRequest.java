package com.javatutor.model;

public class RunRequest {
    private String code;
    //有参构造以及无参构造
    public RunRequest() {
    }
    public RunRequest(String code){
        this.code = code;
    }

    // SpringBoot 使用的Jackson库需要 getter 和 setter 来处理 http 请求和响应的 JSON 数据。
    // getter 和 setter 方法 
    public String getCode(){
        return code;
    }
    public void setCode(String code){
        this.code = code;
    }

    
    

}
