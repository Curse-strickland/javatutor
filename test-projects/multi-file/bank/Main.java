public class Main {
    public static void main(String[] args) {
        BankAccount account = new BankAccount("Alice", 1000);
        account.deposit(500);
        account.withdraw(300);
        boolean ok = account.withdraw(2000); // 余额不足，应返回 false
        System.out.println(account.getName() + " 余额: " + account.getBalance());
        System.out.println("第二次取款成功? " + ok);
    }
}
