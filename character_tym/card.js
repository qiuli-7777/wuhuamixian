import { lib, game, ui, get, ai, _status } from '../../../noname.js'

const cards = {
	ql_bingchuan_shu: {
		derivation: "ql_chicha",
		fullskin: true,
		type: "equip",
		subtype: "equip1",
		distance: {
			attackFrom: -1,
		},
		skills: ["ql_bingchuan_shu_skill"],
		ai: {
			equipValue: 4,
		},
	},
	ql_bingchuan_ge: {
		derivation: "ql_chicha",
		fullskin: true,
		type: "equip",
		subtype: "equip1",
		distance: {
			attackFrom: -2,
		},
		skills: ["ql_bingchuan_ge_skill"],
		ai: {
			equipValue: 4,
		},
	},
	ql_bingchuan_mao: {
		derivation: "ql_chicha",
		fullskin: true,
		type: "equip",
		subtype: "equip1",
		distance: {
			attackFrom: -4,
		},
		skills: ["ql_bingchuan_mao_skill"],
		ai: {
			equipValue: 4,
		},
	},
	ql_bingchuan_ji: {
		derivation: "ql_chicha",
		fullskin: true,
		type: "equip",
		subtype: "equip1",
		distance: {
			attackFrom: -5,
		},
		skills: ["ql_bingchuan_ji_skill"],
		ai: {
			equipValue: 4,
		},
	},
	ql_bingchuan_gong: {
		derivation: "ql_chicha",
		fullskin: true,
		type: "equip",
		subtype: "equip1",
		distance: {
			attackFrom: -8,
		},
		skills: ["ql_bingchuan_gong_skill"],
		ai: {
			equipValue: 4,
		},
	},
};
for (let i in cards) {
	cards[i].fullskin = true;
}
export default cards;
