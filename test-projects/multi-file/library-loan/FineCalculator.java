public class FineCalculator {
    private static final int BORROW_DAYS = 14;    // 借期 14 天
    private static final double DAILY_FINE = 0.5; // 每天罚金 0.5 元

    public double calculate(Loan loan) {
        int overdue = loan.getDays() - BORROW_DAYS;
        if (overdue <= 0) {
            return 0;
        }
        return overdue * DAILY_FINE;
    }
}
