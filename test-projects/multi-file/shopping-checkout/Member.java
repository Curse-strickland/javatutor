public class Member {
    private String name;
    private int level; // 1 普通 / 2 银卡 / 3 金卡
    private int points;

    public Member(String name, int level, int points) {
        this.name = name;
        this.level = level;
        this.points = points;
    }

    public String getName() { return name; }
    public int getLevel() { return level; }
    public int getPoints() { return points; }
    public void addPoints(int p) { points += p; }

    /** 会员折扣率：金卡 8 折，银卡 9 折，普通无折扣 */
    public double discountRate() {
        if (level >= 3) return 0.8;
        if (level == 2) return 0.9;
        return 1.0;
    }
}
