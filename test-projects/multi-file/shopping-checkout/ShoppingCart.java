import java.util.ArrayList;
import java.util.List;

public class ShoppingCart {
    private List<CartItem> items = new ArrayList<>();

    /** 添加商品：校验库存，若购物车已有该商品则累加数量 */
    public boolean add(Product product, int quantity) {
        int existing = 0;
        for (CartItem item : items) {
            if (item.getProduct() == product) {
                existing = item.getQuantity();
                break;
            }
        }
        if (existing + quantity > product.getStock()) {
            return false;
        }
        if (existing > 0) {
            for (CartItem item : items) {
                if (item.getProduct() == product) {
                    item.setQuantity(existing + quantity);
                    return true;
                }
            }
        }
        items.add(new CartItem(product, quantity));
        return true;
    }

    public double total() {
        double sum = 0;
        for (CartItem item : items) {
            sum += item.subtotal();
        }
        return sum;
    }

    public int itemCount() { return items.size(); }
    public List<CartItem> getItems() { return items; }
}
