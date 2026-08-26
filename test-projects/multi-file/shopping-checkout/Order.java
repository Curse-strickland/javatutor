public class Order {
    private Member member;
    private ShoppingCart cart;
    private double total;
    private int earnedPoints;

    public Order(Member member, ShoppingCart cart) {
        this.member = member;
        this.cart = cart;
    }

    /** 结算：按会员折扣计价、累积积分、扣减库存 */
    public void checkout() {
        double raw = cart.total();
        double rate = member.discountRate();
        total = raw * rate;
        earnedPoints = (int) (total / 10);
        member.addPoints(earnedPoints);
        for (CartItem item : cart.getItems()) {
            item.getProduct().reduceStock(item.getQuantity());
        }
    }

    public double getTotal() { return total; }
    public int getEarnedPoints() { return earnedPoints; }
    public Member getMember() { return member; }
}
