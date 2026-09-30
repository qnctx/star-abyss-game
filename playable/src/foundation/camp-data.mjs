import {CAMP_V2_PEOPLE} from '../camp-v2/layout.mjs';
export const PHYSICIAN={id:'N02',name:'苏禾',role:'曙光营地 · 生物医师',...CAMP_V2_PEOPLE.N02.home,yaw:0,radius:CAMP_V2_PEOPLE.N02.radius};
export const CAMP_ITEMS={
  'red-bud':{name:'赤芽草',unitVolumeMl:'200',unitMassGrams:'100'},
  'purified-plasma':{name:'净化血浆',unitVolumeMl:'300',unitMassGrams:'250'},
  'stone-dew':{name:'石露',unitVolumeMl:'200',unitMassGrams:'200'},
  'medical-salt':{name:'药用盐',unitVolumeMl:'100',unitMassGrams:'100'},
  solvent:{name:'纯化溶媒',unitVolumeMl:'100',unitMassGrams:'100'},
  'spirit-fragment':{name:'碎灵石',unitVolumeMl:'1',unitMassGrams:'1'},
  MED01:{name:'止血注剂',unitVolumeMl:'120',unitMassGrams:'150'},
  MED02:{name:'电容补剂',unitVolumeMl:'120',unitMassGrams:'150'},
  MED03:{name:'肌能补剂',unitVolumeMl:'120',unitMassGrams:'150'},
};
export const MEDICINES=Object.freeze({
  MED01:{id:'MED01',name:'止血注剂',ingredients:{'red-bud':2,'purified-plasma':1,solvent:1},useSeconds:2,craftSeconds:30,effect:'恢复最大生命 20%，随后 5 秒恢复 15%',family:'recovery'},
  MED02:{id:'MED02',name:'电容补剂',ingredients:{'moon-moss':2,'stone-dew':1,solvent:1},useSeconds:3,craftSeconds:30,effect:'恢复最大电容 35%',family:'recovery'},
  MED03:{id:'MED03',name:'肌能补剂',ingredients:{'moon-moss':1,'medical-salt':1,solvent:1},useSeconds:2,craftSeconds:30,effect:'恢复体力 40 点',family:'recovery'},
});
export const MEDICINE_COOLDOWN=45;
export const MEDICINE_QUALITY=[0,.8,.9,1,1.1,1.2,1.25];
export const CAMP_TUTORIAL_KIT={'red-bud':2,'purified-plasma':1,'moon-moss':3,'stone-dew':1,'medical-salt':1,solvent:3,'spirit-fragment':2};
export const CAMP_SHOP={
  'red-bud':{buy:3,stock:12},'purified-plasma':{buy:4,stock:6},'moon-moss':{buy:3,stock:12},
  'stone-dew':{buy:3,stock:6},'medical-salt':{buy:2,stock:6},solvent:{buy:1,stock:12},
};
export const CAMP_BUYBACK={'meteor-iron':4,'scavenger-blood':1,'moon-moss':1};
export const CAMP_MESSAGES={campAlreadyTaught:'教学物资已领取，不会重复发放。',campNeedsSample:'带回背包中的一份掠兽血，再开始血样教学。',campNeedsMaterials:'材料不足，未扣除任何物品。',campOrdersFull:'先领取已完成的医剂。',campNotReady:'医剂仍在制作，关闭窗口不会丢失订单。',campUnknownRecipe:'先完成医师血样教学。',campNoMedicine:'背包没有可用的这类医剂。',campCooldown:'三种恢复药共用 45 秒冷却。',campUseActive:'正在使用医剂，先等待或取消。',campUseNotDue:'尚未到医剂生效时间。',campUnsafeTier:'当前境界不能安全使用这份药剂。',campNoOrder:'订单不存在或已领取。',campCapacity:'背包容量不足，订单与物资仍保留。',campDuplicateKit:'教学材料仍在医师待领取栏。',campOutOfStock:'这批研究补给已售罄。',campBuybackEmpty:'医师本批研究经费不足，物资未扣除。',campUseInterrupted:'使用受到打断，药物未消耗。'};
