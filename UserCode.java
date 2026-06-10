public class UserCode {
    static class Item {
        int value;
        Item(int v) { this.value = v; }
    }
    public static void main(String[] args) {
        Item[] arr = new Item[2];
        arr[0] = new Item(10);
        arr[1] = new Item(20);
        arr[0] = arr[1];
        arr[1].value = 99;
        System.out.println(arr[0].value);
    }
}
