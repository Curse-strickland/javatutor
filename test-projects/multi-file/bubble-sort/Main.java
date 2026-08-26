public class Main {
    public static void main(String[] args) {
        int[] arr = {5, 3, 8, 1, 6};
        Sorter sorter = new Sorter();
        sorter.bubbleSort(arr);
        for (int i = 0; i < arr.length; i++) {
            System.out.print(arr[i] + " ");
        }
    }
}
