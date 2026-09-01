package demo;

// 入口类：验证调用关系图（main → 各种方法调用链）
public class Main {
    public static void main(String[] args) {
        Dog dog = new Dog("旺财", 3, "柯基");
        dog.makeSound();
        dog.train();
        dog.fetch();

        Zoo zoo = new Zoo();
        zoo.add(dog);
        zoo.showAll();

        Toy ball = new Toy("飞盘");
        ball.play();
    }
}
