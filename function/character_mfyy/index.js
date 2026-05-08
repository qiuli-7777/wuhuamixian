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
	name: "mfyy",
	connect: true,
	connectBanned: [],
	perfectPair: {},
	character: { ...characters },
	characterSort: {
		mfyy: characterSort,
	},
	characterSubstitute: {
		//dm_zhebang: [["dm_zhebang_shadow", ["die:dm_zhebang"]]],
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
export { characterPack };
