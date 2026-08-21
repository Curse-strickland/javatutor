public class Main {
    public static void main(String[] args) {
        Product apple = new Product("苹果", 5.5, 100);
        Product milk = new Product("牛奶", 12.0, 50);
        Product bread = new Product("面包", 8.0, 30);

        Member member = new Member("张三", 2, 0); // 银卡会员，9 折

        ShoppingCart cart = new ShoppingCart();
        cart.add(apple, 3);
        cart.add(milk, 2);
        cart.add(bread, 1);
        boolean addedTooMany = cart.add(apple, 200); // 库存不足，应失败

        System.out.println("购物车商品种数: " + cart.itemCount());
        System.out.println("原价总额: " + cart.total());
        System.out.println("超量添加成功? " + addedTooMany);

        Order order = new Order(member, cart);
        order.checkout();
        System.out.println("会员: " + order.getMember().getName());
        System.out.println("折后总额: " + order.getTotal());
        System.out.println("获得积分: " + order.getEarnedPoints());
    }
}
