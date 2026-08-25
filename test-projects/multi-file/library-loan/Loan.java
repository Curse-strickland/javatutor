public class Loan {
    private Book book;
    private Member member;
    private int days; // 借出天数

    public Loan(Book book, Member member, int days) {
        this.book = book;
        this.member = member;
        this.days = days;
    }

    public Book getBook() { return book; }
    public Member getMember() { return member; }
    public int getDays() { return days; }
}
