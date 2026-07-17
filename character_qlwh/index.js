import { lib, game, ui, get, ai, _status } from "../../../noname.js";
import characters from "./character.js";
import cards from "./card.js";
import pinyins from "./pinyin.js";
import skills from "./skill.js";
import translates from "./translate.js";
import characterIntros from "./intro.js";
import characterFilters from "./characterFilter.js";
import characterTitles from "./characterTitle.js";
import characterReplaces from "./characterReplace.js";
import dynamicTranslates from "./dynamicTranslate.js";
import voices from "./voices.js";
import { characterSort, characterSortTranslate } from "./sort.js";

const characterPack = {
	name: "qlwh",
	connect: true,
	connectBanned: [],
	perfectPair: {},
	character: { ...characters },
	characterSort: {
		qlwh: characterSort,
	},
	characterSubstitute: {
		ql_bianzhong: [
			["ql_bianzhong_xz", ["ext:五花米线/skin/ql_bianzhong_xz.jpg"]],
			["ql_bianzhong_jzgd", ["ext:五花米线/skin/ql_bianzhong_jzgd.jpg"]],
		],
		ql_jiangyalu: [
			["ql_jiangyalu_xz", ["ext:五花米线/skin/ql_jiangyalu_xz.jpg"]],
			["ql_jiangyalu_jhrh", ["ext:五花米线/skin/ql_jiangyalu_jhrh.jpg"]],
		],
		ql_dilou: [
			["ql_dilou_xz", ["ext:五花米线/skin/ql_dilou_xz.jpg"]],
			["ql_dilou_glc", ["ext:五花米线/skin/ql_dilou_glc.jpg"]],
		],
		ql_xishan: [
			["ql_xishan_xz", ["ext:五花米线/skin/ql_xishan_xz.jpg"]],
			["ql_xishan_dljd", ["ext:五花米线/skin/ql_xishan_dljd.jpg"]],
		],
		ql_tianqiuyi: [
			["ql_tianqiuyi_xz", ["ext:五花米线/skin/ql_tianqiuyi_xz.jpg"]],
		],
		ql_longge: [
			["ql_longge_xz", ["ext:五花米线/skin/ql_longge_xz.jpg"]],
			["ql_longge_bsyy", ["ext:五花米线/skin/ql_longge_bsyy.jpg"]],
		],
		ql_weinasi: [
			["ql_weinasi_xz", ["ext:五花米线/skin/ql_weinasi_xz.jpg"]],
			["ql_weinasi_zyj", ["ext:五花米线/skin/ql_weinasi_zyj.jpg"]],
			["ql_weinasi_yxxs", ["ext:五花米线/skin/ql_weinasi_yxxs.jpg"]],
		],
	    ql_laotou: [
			["ql_laotou_xz", ["ext:五花米线/skin/ql_laotou_xz.jpg"]],
			["ql_laotou_cacs", ["ext:五花米线/skin/ql_laotou_cacs.jpg"]],
		],
		ql_matijin: [
			["ql_matijin_xz", ["ext:五花米线/skin/ql_matijin_xz.jpg"]],
			["ql_matijin_hjy", ["ext:五花米线/skin/ql_matijin_hjy.jpg"]],
		],
		ql_liujin: [
			["ql_liujin_xz", ["ext:五花米线/skin/ql_liujin_xz.jpg"]],
			["ql_liujin_qjdw", ["ext:五花米线/skin/ql_liujin_qjdw.jpg"]],
		],
		ql_danao: [
			["ql_danao_xz", ["ext:五花米线/skin/ql_danao_xz.jpg"]],
			["ql_danao_cf", ["ext:五花米线/skin/ql_danao_cf.jpg"]],
		],
		ql_caifeng: [
			["ql_caifeng_xz", ["ext:五花米线/skin/ql_caifeng_xz.jpg"]],
			["ql_caifeng_fyx", ["ext:五花米线/skin/ql_caifeng_fyx.jpg"]],
			["ql_caifeng_xyxh", ["ext:五花米线/skin/ql_caifeng_xyxh.jpg"]],
		],
		ql_thua: [
			["ql_thua_xz", ["ext:五花米线/skin/ql_thua_xz.jpg"]],
			["ql_thua_xrl", ["ext:五花米线/skin/ql_thua_xrl.jpg"]],
			["ql_thua_fydh", ["ext:五花米线/skin/ql_thua_fydh.jpg"]],
			["ql_thua_bawg", ["ext:五花米线/skin/ql_thua_bawg.jpg"]],
		],
	    ql_wuxing: [
			["ql_wuxing_xz", ["ext:五花米线/skin/ql_wuxing_xz.jpg"]],
			["ql_wuxing_ydyy", ["ext:五花米线/skin/ql_wuxing_ydyy.jpg"]]
		],
	    ql_niuzun: [
			["ql_niuzun_xz", ["ext:五花米线/skin/ql_niuzun_xz.jpg"]],
			["ql_niuzun_csyg", ["ext:五花米线/skin/ql_niuzun_csyg.jpg"]]
		],
		ql_guoping: [
			["ql_guoping_xz", ["ext:五花米线/skin/ql_guoping_xz.jpg"]],
			["ql_guoping_hl", ["ext:五花米线/skin/ql_guoping_hl.jpg"]]
		],
		ql_yaya: [
			["ql_yaya_xz", ["ext:五花米线/skin/ql_yaya_xz.jpg"]],
	        ["ql_yaya_xm", ["ext:五花米线/skin/ql_yaya_xm.jpg"]],
		],
		ql_baishi: [
			["ql_baishi_xz", ["ext:五花米线/skin/ql_baishi_xz.jpg"]],
	        ["ql_baishi_qsqy", ["ext:五花米线/skin/ql_baishi_qsqy.jpg"]],
		],
		ql_tuma: [
			["ql_tuma_xz", ["ext:五花米线/skin/ql_tuma_xz.jpg"]],
	        ["ql_tuma_htyx", ["ext:五花米线/skin/ql_tuma_htyx.jpg"]],
		],
		ql_caomao: [
	        ["ql_caomao_shadow", ["ext:五花米线/skin/ql_caomao_shadow.jpg"]],
	    ],
	    ql_wuxianpipa: [
	        ["ql_pipa_xz", ["ext:五花米线/skin/ql_pipa_xz.jpg"]],
	        ["ql_pipa_sxqs", ["ext:五花米线/skin/ql_pipa_sxqs.jpg"]],
	    ],
	    ql_laoshi: [
	        ["ql_laoshi_xz", ["ext:五花米线/skin/ql_laoshi_xz.jpg"]],
	        ["ql_laoshi_wwws", ["ext:五花米线/skin/ql_laoshi_wwws.jpg"]],
	    ],
	    ql_qingongbo: [
	        ["ql_qingongbo_xz", ["ext:五花米线/skin/ql_qingongbo_xz.jpg"]],
	        ["ql_qingongbo_jlmy", ["ext:五花米线/skin/ql_qingongbo_jlmy.jpg"]],
	    ],
	    ql_shierhua: [
	        ["ql_shierhua_xz", ["ext:五花米线/skin/ql_shierhua_xz.jpg"]],
	        ["ql_shierhua_bzh", ["ext:五花米线/skin/ql_shierhua_bzh.jpg"]],
	        ["ql_shierhua_yhzm", ["ext:五花米线/skin/ql_shierhua_yhzm.jpg"]],
	    ],
	    qlshichangshi: [["shichangshi_dead", ["die:shichangshi"]]],
			scs_zhangrang: [["scs_zhangrang_dead", ["die:shichangshi"]]],
			scs_zhaozhong: [["scs_zhaozhong_dead", ["die:shichangshi"]]],
			scs_sunzhang: [["scs_sunzhang_dead", ["die:shichangshi"]]],
			scs_bilan: [["scs_bilan_dead", ["die:shichangshi"]]],
			scs_xiayun: [["scs_xiayun_dead", ["die:shichangshi"]]],
			scs_hankui: [["scs_hankui_dead", ["die:shichangshi"]]],
			scs_lisong: [["scs_lisong_dead", ["die:shichangshi"]]],
			scs_duangui: [["scs_duangui_dead", ["die:shichangshi"]]],
			scs_guosheng: [["scs_guosheng_dead", ["die:shichangshi"]]],
			scs_gaowang: [["scs_gaowang_dead", ["die:shichangshi"]]],
	    },
	characterFilter: { ...characterFilters },
	characterTitle: { ...characterTitles },
	dynamicTranslate: { ...dynamicTranslates },
	characterIntro: { ...characterIntros },
	characterReplace: { ...characterReplaces },
	card: { ...cards },
	skill: { ...skills },
	translate: { ...translates, ...voices, ...characterSortTranslate },
	pinyins: { ...pinyins },
};
lib.config.characters.add("qlwh");
//lib.translate["qlwh_character_config"] = "五花米线";
//统一加图片路径
/*for (const name in characterPack.characterSubstitute) {
	const info = characterPack.characterSubstitute[name];
	info.forEach(list => list[1].push(`ext:五花米线/skin/${list[0]}.jpg`));
}*/
export { characterPack };