import java.util.ArrayList;
import java.util.List;

public class Library {
    private List<Book> books = new ArrayList<>();

    public void addBook(Book book) { books.add(book); }

    public Book find(String title) {
        for (Book book : books) {
            if (book.getTitle().equals(title)) {
                return book;
            }
        }
        return null;
    }

    public boolean borrow(Member member, String title) {
        Book book = find(title);
        if (book == null || !book.isAvailable()) {
            return false;
        }
        if (!member.canBorrow()) {
            return false;
        }
        book.setAvailable(false);
        member.addBook(book);
        return true;
    }

    public boolean returnBook(Member member, String title) {
        for (Book book : member.getBorrowed()) {
            if (book.getTitle().equals(title)) {
                book.setAvailable(true);
                member.removeBook(book);
                return true;
            }
        }
        return false;
    }

    public int availableCount() {
        int count = 0;
        for (Book book : books) {
            if (book.isAvailable()) {
                count++;
            }
        }
        return count;
    }
}
