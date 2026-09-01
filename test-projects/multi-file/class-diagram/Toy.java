package demo;

// 玩具：被 Dog 依赖（depends_on），验证依赖关系
public class Toy {
    private String name;

    public Toy(String name) {
        this.name = name;
    }

    public void play() {
        System.out.println("玩" + name);
    }
}
