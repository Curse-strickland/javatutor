package demo;

// 狗：继承 Animal + 实现 Trainable，验证多继承关系
public class Dog extends Animal implements Trainable {
    private String breed;
    private Toy toy;

    public Dog(String name, int age, String breed) {
        super(name, age);
        this.breed = breed;
        this.toy = new Toy("球");
    }

    @Override
    public void makeSound() {
        System.out.println("汪");
    }

    @Override
    public void train() {
        System.out.println(getName() + " 在训练");
    }

    public void fetch() {
        toy.play();
    }

    public String getBreed() {
        return breed;
    }
}
