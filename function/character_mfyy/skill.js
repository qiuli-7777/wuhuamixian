import { lib, game, ui, get, ai, _status } from "../../../noname.js";

/** @type { importCharacterConfig['skill'] } */
const skills = {
	//曹植
	mfyy_caoli: {
		forced: true,
		mark: true,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage) {
				return "锁定技，当你使用“草隶”牌时，摸两张牌并" + (!storage ? "视为使用一张【酒】" : "视为使用一张【杀】") + "。你的【酒】的效果不会因回合结束失去。";
			},
		},
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			return player.hasHistory("lose", evt => {
				return (evt.relatedEvent || evt.getParent()) == event && evt.hs.length && Object.values(evt.gaintag_map).flat().includes("mfyy_caoli");
			})
		},
		async content(event, trigger, player) {
			const bool = player.storage[event.name];
			player.changeZhuanhuanji(event.name);
			await player.draw(2);
			const vcard = get.autoViewAs({ name: !bool ? "jiu" : "sha", isCard: true });
			if (player.hasUseTarget(vcard, void 0, false)) {
				await player.chooseUseTarget(vcard, true, false);
			}
		},
		group: "mfyy_caoli_init",
		subSkill: {
			init: {
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				async content(event, trigger, player) {
					const cards = player.getCards("h");
					player.addGaintag(cards, event.name.split("_").slice(0, -1).join("_"));
				},
			}
		},
		ai: {
			jiuSustain: true,
			skillTagFilter(player, tag, name) {
				if (name != "phase") {
					return false;
				}
			},
		}
	},
	mfyy_caidou: {
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + player.countMark(skill);
		},
		filter(event, player) {
			if (!player.hasCard({ color: "black" }, "hs")) {
				return false;
			}
			for (const i of lib.inpile) {
				if (get.type(i) == "trick" && event.filterCard(get.autoViewAs({ name: i, isCard: true }, "unsure"), player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i of lib.inpile) {
					if (get.type(i) == "trick" && event.filterCard(get.autoViewAs({ name: i, isCard: true }, "unsure"), player, event)) {
						list.push(["锦囊", "", i]);
					}
				}
				return ui.create.dialog("才斗", [list, "vcard"]);
			},
			check(button) {
				return _status.event.player.getUseValue({ name: button.link[2], isCard: true });
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
					},
					filterCard(card, player) {
						return get.color(card) == "black";
					},
					selectCard: 1,
					position: "hs",
					popname: true,
					log: false,
					async precontent(event, trigger, player) {
						const skill = "mfyy_caidou";
						player.logSkill(skill);
						event.getParent().oncard = function () {
							const event = get.event();
							player
								.when("useCardAfter")
								.filter(evt => evt.card == event.card)
								.then(async (event, trigger, player) => {
									const num = player.getHistory("useSkill", evt => evt.skill == skill).length;
									const tag = "mfyy_caoli";
									let result;
									if (player.countDiscardableCards(player, "he") < num) {
										result = { index: 1 };
									} else {
										result = await player
											.chooseControl()
											.set("choiceList", [
												`弃置${num}张牌并将一张手牌标记为“草隶”牌，然后本回合该技能发动次数+1`,
												`摸${num}张牌并标记为“草隶”牌`
											])
											.set("choice", (() => {
												if (num <= 3 && player.countDiscardableCards("he") > num) {
													return 0;
												}
												return 1;
											})())
											.forResult();
									}
									if (typeof result.index == "number") {
										if (result.index == 0) {
											await player.chooseToDiscard("he", num, true);
											if (player.countCards("h")) {
												const result2 = await player
													.chooseCard("才斗：请标记一张牌为“草隶”", "h", true)
													.set("ai", card => get.player().getUseValue(card))
													.forResult();
												const { cards } = result2;
												player.addGaintag(cards, tag);
											}
											player.addMark(skill, 1, false);
											player.addTempSkill(skill + "_clear");
										} else {
											const next = player.draw(num);
											next.gaintag.add(tag);
											await next;
										}
									}
								})
						}
					},
				};
			},
			prompt(links, player) {
				return "请选择" + get.translation(links[0][2]) + "的目标";
			},
		},
		subSkill: {
			clear: {
				charlotte: true,
				onremove(player, skill) {
					player.clearMark("mfyy_caidou", false);
				}
			}
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
		},
	},
	mfyy_buzuo: {
		trigger: {
			global: "roundStart",
		},
		async content(event, trigger, player) {
			const choices = ["basic", "trick", "equip"];
			const list = [];
			for (let i = 0; i < 7; i++) {
				const result = await player
					.chooseControl(choices)
					.set("prompt", `###步作：请选择要声明的类别（${list.length}/7）###${get.translation(list)}`)
					.set("choice", get.rand(0, choices.length - 1))
					.forResult();
				list.push(result.control);
			}
			player.setStorage(event.name + "_use", list, true);
			player.addTempSkill(event.name + "_use", "roundStart");
		},
		check: () => true,
		subSkill: {
			use: {
				charlotte: true,
				forced: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip("mfyy_buzuo_record");
				},
				trigger: {
					player: "useCard",
				},
				filter(event, player) {
					if (!player.hasHistory("lose", evt => {
						return (evt.relatedEvent || evt.getParent()) == event && evt.hs.length && Object.values(evt.gaintag_map).flat().includes("mfyy_caoli");
					})) {
						return false;
					}
					const index = player.getRoundHistory("useCard", evtx => {
						return player.getRoundHistory("lose", evt => {
							return (evt.relatedEvent || evt.getParent()) == evtx && evt.hs.length && Object.values(evt.gaintag_map).flat().includes("mfyy_caoli");
						}).length > 0
					}).indexOf(event);
					return index >= 0 && index < 7 && player.getStorage("mfyy_buzuo_use")[index] == get.type2(event.card);
				},
				async content(event, trigger, player) {
					await player.draw();
					trigger.effectCount++;
				},
				intro: {
					content: "已声明：$"
				},
				group: ["mfyy_buzuo_record"],
			},
			record: {
				init(player, skill) {
					const storage = player.getStorage("mfyy_buzuo_use");
					const index = player.getRoundHistory("useCard", evtx => {
						return player.getRoundHistory("lose", evt => {
							return (evt.relatedEvent || evt.getParent()) == evtx && evt.hs.length && Object.values(evt.gaintag_map).flat().includes("mfyy_caoli");
						}).length > 0
					}).length;
					if (index >= 7) {
						player.removeTip(skill);
					} else {
						player.addTip(skill, `步作 ${get.translation(storage[index])}`);
					}
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				charlotte: true,
				silent: true,
				trigger: {
					player: "useCard1",
				},
				filter(event, player) {
					return player.hasHistory("lose", evt => {
						return (evt.relatedEvent || evt.getParent()) == event && evt.hs.length && Object.values(evt.gaintag_map).flat().includes("mfyy_caoli");
					})
				},
				async content(event, trigger, player) {
					get.info(event.name).init(player, event.name);
				}
			},
		},
		ai: {
			combo: ["mfyy_caoli", "mfyy_caidou"],
		}
	},
	//胡昭
	mfyy_haoli: {
		forced: true,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			const cards = player.getCards("h");
			player.addGaintag(cards, event.name);
		},
		group: ["mfyy_haoli_useCard"],
		subSkill: {
			useCard: {
				forced: true,
				trigger: { player: "useCard" },
				filter(event, player) {
					return player.hasHistory("lose", evt => (evt.relatedEvent || evt.getParent()) == event && Object.values(evt.gaintag_map).flat().includes("mfyy_haoli"));
				},
				async content(event, trigger, player) {
					player.addTempSkill("mfyy_haoli_effect");
					player.addMark("mfyy_haoli_effect", 1, false);
				},
			},
			effect: {
				forced: true,
				charlotte: true,
				intro: {
					content: "使用牌造成的伤害+#",
				},
				onremove: true,
				trigger: {
					source: ["damageSource", "damageBegin1"],
				},
				filter(event, player) {
					return event.card;
				},
				async content(event, trigger, player) {
					if (event.triggername == "damageBegin1") {
						trigger.num += player.countMark(event.name);
					} else {
						await player.draw(trigger.num);
					}
				},
			},
		}
	},
	mfyy_yinshou: {
		trigger: {
			global: "phaseBegin",
		},
		filter(event, player) {
			const history = player.actionHistory;
			if (!player.hasCard(card => !card.hasGaintag("mfyy_haoli"), "h")) {
				return false;
			}
			if (history.length <= 2) {
				return true;
			}
			const last = history[history.length - 2];
			return !last["damage"]?.length && !last["sourceDamage"]?.length;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), "h", card => !card.hasGaintag("mfyy_haoli"))
				.set("ai", card => {
					if (get.is.damageCard(card)) {
						return get.player().getUseValue(card) + 2;
					}
					return get.player().getUseValue(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards: [card] } = event;
			player.addGaintag(card, "mfyy_haoli");
			const type = get.type2(card);
			const list = get.inpileVCardList(info => {
				if (!["basic", "trick"].includes(info[0]) || info[0] == type) {
					return false;
				}
				const cardx = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
				return (get.info(cardx).notarget && lib.filter.cardEnabled(cardx, player)) || player.hasUseTarget(cardx, true, false);
			});
			if (list.length) {
				const result = await player
					.chooseButton([
						`隐授：视为使用一张基本牌或普通锦囊牌`,
						[list, "vcard"]
					], true)
					.set("ai", button => {
						return get.player().getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3], isCard: true }), true, false);
					})
					.forResult();
				const { links: [info] } = result;
				const card = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
				await player.chooseUseTarget(card, true, false);
			}
		}
	},
	mfyy_mochuan: {
		locked: true,
		trigger: {
			global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter"],
		},
		filter(event, player, name, card) {
			return get.position(card) == "d";
		},
		getIndex(event, player) {
			const cards = event.getd();
			if (!cards.length) {
				return [];
			}
			const list = [];
			if (event.name != "cardsDiscard") {
				const gaintag_map = game.filterPlayer2().reduce((map, target) => { return { ...map, ...(event.getl(target).gaintag_map || {}) } }, {});
				cards.forEach(card => {
					if (gaintag_map?.[card.cardid]?.includes("mfyy_haoli")) {
						list.push(card);
					}
				})
			} else {
				const evt = event.getParent();
				const evtx = evt.relatedEvent || evt.getParent();
				const gaintag_map = game.filterPlayer2().reduce((map, target) => {
					return {
						...map,
						...target.getHistory("lose", evt => (evt.relatedEvent || evt.getParent()) == evtx).reduce((map, evt) => {
							return {
								...map,
								...(evt.gaintag_map || {})
							}
						}, {})
					}
				}, {});
				cards.forEach(card => {
					if (gaintag_map?.[card.cardid]?.includes("mfyy_haoli")) {
						list.push(card);
					}
				})
			}
			return list;
		},
		frequent: true,
		async cost(event, trigger, player) {
			const card = event.indexedData;
			event.result = await player
				.chooseBool()
				.set("createDialog", [
					`###${get.prompt(event.skill)}###将此牌移出游戏，然后随机从弃牌堆内获得一张相同类型的牌`,
					[card],
					[dialog => dialog.buttons.forEach(i => i.style.setProperty("opacity", 1)), "handle"]
				])
				.set("choice", true)
				.set("frequentSkill", event.skill)
				.forResult();
		},
		async content(event, trigger, player) {
			const card = event.indexedData;
			const next = player.addToExpansion(card, "gain2");
			next.gaintag.add(event.name);
			await next;
			const cardx = get.discardPile(cardx => get.type2(cardx) == get.type2(card), "random");
			if (cardx) {
				await player.gain(cardx, "gain2");
			} else {
				player.chat("无牌可得");
			}
		},
		ai: {
			combo: ["mfyy_haoli", "mfyy_yinshou"],
		},
		intro: {
			markcount: "expansion",
			content: "expansion",
		}
	},
	//卫觊
	mfyy_jianti: {
		group: ["mfyy_jianti_init"],
		forced: true,
		trigger: {
			player: ["useCardAfter", "phaseJieshuBegin"],
		},
		filter(event, player) {
			if (event.name == "useCard") {
				return player.hasHistory("lose", evt => {
					return (evt.relatedEvent || evt.getParent()) == event && Object.values(evt.gaintag_map).flat().includes("mfyy_jianti");
				}) && get.info("mfyy_jianti").getList(player, event.card).length;
			}
			return true;
		},
		getList(player, card) {
			const len = get.cardNameLength(card);
			return get.inpileVCardList(info => {
				if (!["basic", "trick"].includes(info[0]) || player.getStorage("mfyy_jianti_used").includes(info[2])) {
					return false;
				}
				const cardx = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
				return get.cardNameLength(cardx) == len && ((get.info(cardx).notarget && lib.filter.cardEnabled(cardx, player)) || player.hasUseTarget(cardx, true, false));
			});
		},
		async content(event, trigger, player) {
			if (trigger.name == "useCard") {
				const list = get.info(event.name).getList(player, trigger.card);
				const result = await player
					.chooseButton([
						`兼体：视为使用一张基本牌或普通锦囊牌`,
						[list, "vcard"]
					], true)
					.set("ai", button => {
						return get.player().getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3], isCard: true }), true, false);
					})
					.forResult();
				const { links: [info] } = result;
				player.addTempSkill(`${event.name}_used`);
				player.markAuto(`${event.name}_used`, info[2]);
				const card = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
				await player.chooseUseTarget(card, true, false);
			}
			else {
				await player.draw(2);
				let cards = player.getCards("h");
				cards = cards.randomGets(Math.ceil(cards.length / 2));
				if (cards.length) {
					player.addGaintag(cards, event.name);
				}
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已使用：$",
				},
			},
			init: {
				trigger: {
					player: "enterGame",
					global: "phaseBefore",
				},
				filter(event, player) {
					if (!player.countCards("h")) {
						return false;
					}
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				async content(event, trigger, player) {
					player.addGaintag(player.getCards("h"), "mfyy_jianti");
				}
			},
		},
	},
	mfyy_shucheng: {
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => card.hasGaintag("mfyy_jianti"), "h");
		},
		filterCard(card, player) {
			return card.hasGaintag("mfyy_jianti");
		},
		filterTarget: lib.filter.notMe,
		lose: false,
		discard: false,
		delay: false,
		check(card) {
			return 6 - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.give(cards, target);
			const storage = player.getStorage(`${event.name}_selected`);
			const str = get.translation(player);
			const list = get.inpileVCardList(info => {
				if (info[0] !== "trick") {
					return false;
				}
				const cardx = get.autoViewAs({ name: info[2], isCard: true });
				return (get.info(cardx).notarget && lib.filter.cardEnabled(cardx, player)) || player.hasUseTarget(cardx, true, false);
			});
			const result = await target
				.chooseButton([
					`书承：${str}令你选择一项`,
					[
						[
							[1, `摸两张牌，然后交给${str}一张手牌`],
							[2, `令${str}将至多两张手牌标记为“兼体”牌`],
							[3, `恢复1点体力值并复原武将牌`],
							[4, `视为使用一张普通锦囊牌且下次造成的伤害+1`],
						],
						"textbutton"
					]
				], true)
				.set("selected", storage)
				.set("list", list)
				.set("sourcex", player)
				.set("ai", button => {
					const { sourcex, player } = get.event();
					switch (button.link) {
						case 1: {
							return get.effect(player, { name: "draw" }, sourcex, player) * 2.5;
						}
						case 2: {
							return sourcex.countCards("h", card => card.hasGaintag("mfyy_jianti")) > 1 ? 1.5 : 2.5;
						}
						case 3: {
							return get.recoverEffect(player, sourcex, player) + (player.isLinked() ? 2 : 0) + (player.isTurnedOver() ? 4 : 0);
						}
						case 4: {
							return Math.max(...get.event().list.map(info => player.getUseValue(get.autoViewAs({ name: info[2], nature: info[3], isCard: true }))));
						}
					}
				})
				.set("filterButton", button => {
					return !get.event().selected?.includes(button.link);
				})
				.forResult();
			const { links: [link] } = result;
			player.markAuto(`${event.name}_selected`, link);
			if (player.getStorage(`${event.name}_selected`).length >= 4) {
				player.unmarkAuto(`${event.name}_selected`, player.getStorage(`${event.name}_selected`));
			}
			switch (link) {
				case 1: {
					await target.draw(2);
					await target.chooseToGive(player, "h", true);
					break;
				}
				case 2: {
					const result = await player.chooseCard("书承: 将至多两张手牌标记为“兼体”牌", [1, 2], "h").forResult();
					const { cards } = result;
					player.addGaintag(cards, "mfyy_jianti");
					break;
				}
				case 3: {
					await target.recover();
					await target.link(false);
					await target.turnOver(false);
					break;
				}
				case 4: {
					target.addSkill(`${event.name}_damage`);
					if (list.length) {
						const result = await target
							.chooseButton([
								`书承：视为使用一张普通锦囊牌`,
								[list, "vcard"]
							], true)
							.set("ai", button => {
								return get.player().getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3], isCard: true }), true, false);
							})
							.forResult();
						const { links: [info] } = result;
						const card = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
						await target.chooseUseTarget(card, true, false);
					}
					break;
				}
			}
		},
		subSkill: {
			damage: {
				charlotte: true,
				silent: true,
				trigger: {
					source: "damageBegin1",
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					trigger.num++;
				},
				mark: true,
				intro: {
					content: "下次造成的伤害+1",
				}
			},
		},
		ai: {
			combo: "mfyy_jianti",
			order: 7,
			result: {
				target: 1,
			}
		}
	},
};

export default skills;
