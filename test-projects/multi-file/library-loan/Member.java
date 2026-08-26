import java.util.ArrayList;
import java.util.List;

public class Member {
    private String name;
    private String cardNo;
    private List<Book> borrowed = new ArrayList<>();
    private static final int MAX_BORROW = 3;

    public Member(String name, String cardNo) {
        this.name = name;
        this.cardNo = cardNo;
    }

    public String getName() { return name; }
    public String getCardNo() { return cardNo; }
    public List<Book> getBorrowed() { return borrowed; }

    public boolean canBorrow() {
        return borrowed.size() < MAX_BORROW;
    }

    public void addBook(Book book) { borrowed.add(book); }
    public void removeBook(Book book) { borrowed.remove(book); }
}
