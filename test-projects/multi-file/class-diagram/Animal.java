package demo;

// 动物基类：用于验证类图的继承关系（extends）
public abstract class Animal {
    private String name;
    protected int age;

    public Animal(String name, int age) {
        this.name = name;
        this.age = age;
    }

    public String getName() {
        return name;
    }

    public abstract void makeSound();
}
