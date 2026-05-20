import characters from "./character.js";

const characterSort = {
    qlconnect: ["ql_tienan", "ql_matijin", "ql_liujin", "ql_danao", "ql_caifeng", "ql_thua", "chuqi", "yh_ganning", "yh_luxun", "yh_xuyou", "ql_caoang", "ql_caomao", "qlxiahoulingnv", "qlzhuling", "ql_xuchu", "ql_zhanghe", "qlhuangzhong", "qljiangwej", "qlliyan", "ql_lingtong", "qllukang", "qltaishici", "qlzoushi", "qljushou", "qlshenpei", "qlshichangshi", "qlwangjun", "qlzuoci", "ql_xushao", "ql_baishi", "ql_bianzhong", "ql_changxingongdeng", "ql_efeiliusi", "ql_jianmo", "ql_kuisangti", "ql_niaozun", "qlchedanbei", "qldashenkan", "qlligui", "ql_wuxing", "qlyexingtongpai", "qlyucongwang", "ql_sushadanyi", "ql_taozi", "ql_tuma", "ql_xiaoma", "ql_yaya", "ql_zhaoxin", "ql_liuzhang", "qljiangwei"],
    qlalone: ["qlcaiwenji","qldaqiao","qlxizhicai","qlyanghu","qlxinxianying","ql_xiahoushang","ql_jiangwan","ql_puyuan","qlzhaoxiang","qlsunyi","qlsunquan","ql_sunjian","qlzerong","ql_guoping","ql_ying_jihuoyishou","ql_qingongbo","ql_laoshi","ql_shierhua","ql_wuxianpipa","ql_niuzun","qlgoujian","tr_xihe","qlzhaoyun", "qiuli", "qiulitwo", "qlfuronglu", "qlgoujian2", "qlhuoguomiji", "qlqianli", "qlsilongsifengzuo", "qlweisuojiaju", "qlxuejing", "ql_shuijingbei", "ql_weilusi", "ql_yaheng"],
    qlOtherDesign: ["hb_hui", "ql_laola"],
	/*qlyoungHero: ["yh_xuyou", "yh_ganning", "yh_luxun"],
	qleliteWarriorl: ["ql_caomao", "ql_caoang", "ql_sunjian","ql_xiahoushang", "qlxiahoulingnv", "qlshenpei", "qltaishici", "qlzhuling", "qlzuoci", "qlzhaoyun", "qlsunquan", "qlsunyi", "qljiangwei", "qlshichangshi", "qlzerong","qlhuangzhong","qljushou","qlxinxianying","qlliyan","qllukang","qlwangjun","ql_xuchu","ql_zhanghe","ql_puyuan","ql_lingtong","qlzoushi","ql_xushao","ql_jiangwan", "ql_liuzhang"],
	qlshuraReturns: ["qlzhaoxiang"],
	qlGods: ["qlxizhicai", "qlcaiwenji", "qldaqiao", "qlkaier"],
	qlwuhua: ["ql_thua", "ql_guoping", "ql_yaya", "ql_baishi", "ql_tuma", "ql_taozi", "ql_qingongbo", "ql_bianzhong", "ql_shuijingbei", "qlxuejing", "qlligui", "qlweisuojiaju", "qlfuronglu", "qlyucongwang", "qlhuoguomiji", "qlgoujian", "qlchedanbei", "qldashenkan", "qlyexingtongpai", "qlgoujian", "ql_changxingongdeng","qlqianli","qlsilongsifengzuo","ql_wuxing","ql_laoshi","ql_niaozun","ql_shierhua","ql_sushadanyi","ql_wuxianpipa", "ql_xiaoma"],
	qlBoss: ["ql_ying_jihuoyishou","tr_xihe"],
	qllol: ["ql_kuisangti", "ql_jianmo","ql_zhaoxin","ql_yaheng","ql_weilusi", "ql_efeiliusi"],
	ql_wait: [],*/
};

const characterSortTranslate = {
    qllol: "英雄联盟",
	qlyoungHero: "少年英雄",
	qleliteWarriorl: "三国武将",
	qlshuraReturns: "特殊武将",
	qlBoss: "BOSS",
	qlGods: "神法天地",
	qlwuhua: "物华弥新",
	qlwait: "未分包",
	qlconnect: "联机包",
	qlalone: "单机包",
	qlOtherDesign: "别人设计",
};

export { characterSort, characterSortTranslate };
