package demo;

// 动物园：聚合多个动物，验证集合字段依赖
public class Zoo {
    private java.util.List<Animal> animals = new java.util.ArrayList<>();

    public void add(Animal a) {
        animals.add(a);
    }

    public void showAll() {
        for (Animal a : animals) {
            a.makeSound();
        }
    }
}
