import { Library, Game, UI, Get, AI, status, lib } from "noname";
import { Player, GameEvent } from "nonameElement";

declare module "nonameElement" {
    interface Player {
        /**
         * 默认获取主将的职业
         * @param translate 是否改为返回职业翻译后的文本 
         * @param sub 是否获取副将的职业
         * @returns 职业字符串，若无职业或不合法则返回 null
         */
        ql_getCareer(translate?: boolean, sub?:boolean): string | null;

        /**
         * 五花米线自定义召唤事件
         * @param target 新玩家的下家
         * @param character 新玩家主将
         * @param character2 新玩家副将
         * @param isNext 是否添加到下家
         * @param config 一些别的参数塞这来！
         */
        ql_addPlayer(
            target: Player,
            character: string,
            character2?: string | undefined | null,
            isNext?: boolean,
            config?: addPLayerConfig,
        ): GameEvent;

        /**
         * 五花米线自定义移除角色事件
         * @param target 要移除的角色
         * @param config 一些别的参数塞这来！
         */
        ql_removePlayer(target?: Player, config?: removePlayerConfig): GameEvent;
    }
}

declare module "noname" {
    interface Library {
        /**
         * 五花米线里职业的映射表
         */
        ql_careerMap: Map<string, string>;
    }
}

interface addPLayerConfig {
    /**召唤者的来源，不填就是当前角色 */
    source?: Player,
    /**召唤来源技能 */
    sourceSkill?: string,
    /**召唤动画，有默认动画，自定义动画须返回一个promise；false则不生成动画 */
    animate?: false | ((player: Player) => Promise<any>),
    /**是否操控，不填默认false，为Player对象则由该对象操控，其他情况均为召唤来源 */
    isControl?: boolean | Player,
    /**是否死亡时移除，默认为true */
    dieRemove?: boolean,
    /**起始手牌数量。默认为4 */
    startCards?: number,
    /**允许自定义身份，默认跟随召唤来源 */
    identity?: string,
    /**不参与胜负结算，默认为false */
    noCheckResult?: boolean,
    callback?: ((event: GameEvent, player: Player) => PromiseLike<any | void>),
}
interface removePlayerConfig {
    /**移除角色的来源，不填就是当前角色 */
    source?: Player,
    /**移除player的动画，有默认动画，自定义动画须返回一个promise；false则不生成动画 */
    animate?: false | ((player: Player) => Promise<any>),
    callback?: ((event: GameEvent, player: Player) => PromiseLike<any | void>),
}