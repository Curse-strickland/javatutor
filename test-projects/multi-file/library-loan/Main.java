public class Main {
    public static void main(String[] args) {
        Library library = new Library();
        library.addBook(new Book("Java编程思想", "Bruce Eckel", "978-1"));
        library.addBook(new Book("算法导论", "CLRS", "978-2"));
        library.addBook(new Book("设计模式", "GoF", "978-3"));
        library.addBook(new Book("重构", "Martin Fowler", "978-4"));

        Member alice = new Member("Alice", "M001");
        Member bob = new Member("Bob", "M002");

        boolean ok1 = library.borrow(alice, "Java编程思想");
        boolean ok2 = library.borrow(alice, "算法导论");
        boolean ok3 = library.borrow(alice, "设计模式");
        boolean ok4 = library.borrow(alice, "重构");        // 超过 3 本上限，应失败
        boolean ok5 = library.borrow(bob, "Java编程思想");  // 已被借走，应失败

        System.out.println("借第1本: " + ok1);
        System.out.println("借第2本: " + ok2);
        System.out.println("借第3本: " + ok3);
        System.out.println("借第4本(超上限): " + ok4);
        System.out.println("Bob借已借出的书: " + ok5);

        boolean returned = library.returnBook(alice, "算法导论");
        System.out.println("归还算法导论: " + returned);

        Loan loan = new Loan(library.find("Java编程思想"), alice, 20); // 借了 20 天
        FineCalculator fine = new FineCalculator();
        double fee = fine.calculate(loan);
        System.out.println("逾期罚款: " + fee);
        System.out.println("可借书数量: " + library.availableCount());
    }
}
