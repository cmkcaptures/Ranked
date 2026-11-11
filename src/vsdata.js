// VS Arena fighter database.
// Tiers come from the VS Battles Wiki (pulled Nov 2026, per era/form); "plus" = how far a form goes past that tier
// ("higher" ≈ +1, "far higher" ≈ +2-3). Speed: 1 human … 6 hypersonic … 9 FTL … 11 MFTL+ … 12 immeasurable.
// Abilities feed the hax rules in vsengine.js. Community notes reflect r/PowerScaling / r/whowouldwin vibes.

export const TIERS = ['10-B', '10-A', '9-C', '9-B', '9-A', '8-C', 'High 8-C', '8-B', '8-A', 'Low 7-C', '7-C', 'High 7-C', 'Low 7-B', '7-B', '7-A', 'High 7-A',
  '6-C', 'High 6-C', 'Low 6-B', '6-B', 'High 6-B', '6-A', 'High 6-A', '5-C', 'Low 5-B', '5-B', '5-A', 'High 5-A', '4-C', 'High 4-C', '4-B', '4-A',
  '3-C', '3-B', '3-A', 'High 3-A', 'Low 2-C', '2-C', '2-B', '2-A', 'Low 1-C', '1-C']
export const TIER_NAMES = {
  '10-B': 'Human', '9-B': 'Wall', '9-A': 'Small building', '8-C': 'Building', 'High 8-C': 'Large building', '8-B': 'City block', '8-A': 'Multi-city block',
  'Low 7-C': 'Small town', '7-C': 'Town', 'High 7-C': 'Large town', 'Low 7-B': 'Small city', '7-B': 'City', '7-A': 'Mountain', 'High 7-A': 'Large mountain',
  '6-C': 'Island', 'High 6-C': 'Large island', 'Low 6-B': 'Small country', '6-B': 'Country', 'High 6-B': 'Large country', '6-A': 'Continent', 'High 6-A': 'Multi-continent',
  '5-C': 'Moon', 'Low 5-B': 'Small planet', '5-B': 'Planet', '5-A': 'Large planet', 'High 5-A': 'Dwarf star', '4-C': 'Star', 'High 4-C': 'Large star',
  '4-B': 'Solar system', '4-A': 'Multi-solar system', '3-C': 'Galaxy', '3-B': 'Multi-galaxy', '3-A': 'Universe', 'High 3-A': 'High universe',
  'Low 2-C': 'Low universal+', '2-C': 'Low multiverse', '2-B': 'Multiverse', '2-A': 'Multiverse+', 'Low 1-C': 'Low complex multiverse', '1-C': 'Complex multiverse',
}
export const ABILITY = {
  erase: 'Erasure / existence deletion', infinity: 'Infinity (untouchable space)', spacecut: 'Space-cutting attacks', soul: 'Soul attacks', soulres: 'Soul resistance',
  mind: 'Mind control / illusions', mindres: 'Mind resistance', timestop: 'Time stop', timemove: 'Moves in stopped time', precog: 'Precognition / auto-dodge',
  regen: 'High regeneration', immortal: 'Hard to kill (immortality)', antimagic: 'Anti-magic', magic: 'Magic-based', conceptual: 'Conceptual / reality warping',
  toon: 'Toon force', domain: 'Domain expansion', haki: 'Haki (ignores intangibility)', poison: 'Poison', copy: 'Copying / absorption', summon: 'Summons / armies',
  futuresight: 'Sees and rewrites the future', fly: 'Flight', tele: 'Teleportation', sealing: 'Sealing', durneg: 'Ignores durability', stealth: 'Stealth',
}

const F = (id, name, era, tier, plus, spd, iq, stam, abil, feats, weak, note) => ({ id, name, era, tier, plus, spd, iq, stam, abil, feats, weak, note })

export const FIGHTERS = [
  // ===================== Dragon Ball =====================
  { id: 'goku', name: 'Goku', search: 'Gokuu Son', series: 'Dragon Ball', forms: [
    F('ssj-namek', 'Super Saiyan (Namek)', 'DBZ: Frieza Saga', '5-B', 1, 9, 7, 9, ['fly', 'tele'], ['Beat Final Form Frieza as Namek collapsed'], ['Holds back, gives opponents chances'], 'Planet-level by Namek; nobody disputes it.'),
    F('ssb', 'Super Saiyan Blue', 'DBS: Golden Frieza – U6', '2-C', 1, 10, 7, 7, ['fly', 'tele'], ['Fought Golden Frieza & Hit', 'SSB Kaioken'], ['Blue burns stamina fast'], 'VSB puts DBS at low-multiversal (2-C); Reddit mostly agrees.'),
    F('uis', 'Ultra Instinct Sign', 'DBS: Tournament of Power', '2-C', 2, 11, 7, 6, ['fly', 'tele', 'precog'], ['Pushed Jiren', 'Auto-dodges by instinct'], ['Unstable, wears off'], 'The form that launched a thousand "Goku solos" posts.'),
    F('mui', 'Mastered Ultra Instinct', 'DBS: ToP finale / manga', '2-C', 3, 12, 8, 6, ['fly', 'tele', 'precog'], ['Overwhelmed Jiren', 'Perfected UI vs Moro'], ['Can\'t sustain it for long'], 'Top of the Goku tier list; Reddit treats it as multiversal speed.'),
  ] },
  { id: 'vegeta', name: 'Vegeta', search: 'Vegeta', series: 'Dragon Ball', forms: [
    F('ssbe', 'SSB Evolution', 'DBS: Broly', '2-C', 1, 10, 8, 8, ['fly'], ['Held Broly off', 'Fought Toppo'], ['Pride gets him punished'], 'Usually scaled just under Goku.'),
    F('ue', 'Ultra Ego', 'DBS: Granolah Arc', '2-C', 3, 11, 7, 9, ['fly', 'regen'], ['Gets stronger the more he\'s hurt', 'Destroyer-style energy'], ['Takes damage on purpose'], 'Reddit calls Ultra Ego roughly equal to MUI.'),
  ] },
  { id: 'frieza', name: 'Frieza', search: 'Frieza', series: 'Dragon Ball', forms: [
    F('golden', 'Golden Frieza', 'DBS: Resurrection F', '2-C', 1, 10, 9, 6, ['fly'], ['Matched SSB Goku'], ['Stamina drain'], 'Strong but nerfed by stamina.'),
    F('black', 'Black Frieza', 'DBS manga: Granolah', '2-C', 4, 12, 9, 9, ['fly'], ['One-shot UI Goku and Ultra Ego Vegeta'], ['Arrogance'], 'Currently the strongest mortal in DB; Reddit agrees.'),
  ] },
  { id: 'beerus', name: 'Beerus', search: 'Beerus', series: 'Dragon Ball', forms: [
    F('beerus', 'God of Destruction', 'DBS', '2-C', 3, 11, 8, 9, ['fly', 'erase', 'precog'], ['Hakai erases things from existence', 'Clash shook the universe'], ['Lazy, toys with people'], 'Hakai is a scary bit of hax in any matchup.'),
  ] },
  // ===================== One Piece =====================
  { id: 'luffy', name: 'Luffy', search: 'Luffy Monkey', series: 'One Piece', forms: [
    F('g2-3', 'Gear 2 & 3', 'Pre-timeskip', '6-C', 1, 6, 5, 8, [], ['Beat Lucci & Moria'], ['Weak to seastone, water'], 'Island level pre-timeskip.'),
    F('g4', 'Gear 4 Boundman', 'Whole Cake Island', '6-B', 2, 7, 6, 8, ['haki'], ['Beat Katakuri'], ['Haki runs out, 10-min cooldown'], 'Country-level, highly debated.'),
    F('g5', 'Gear 5', 'Wano – Final Saga', 'Low 5-B', 2, 8, 6, 7, ['haki', 'toon', 'regen'], ['Beat Kaido', 'Toon force: rubber reality'], ['Stamina crash after'], 'VSB: small planet+. Reddit loves Gear 5 toon force, but it\'s capped by Luffy\'s imagination.'),
  ] },
  { id: 'zoro', name: 'Zoro', search: 'Zoro Roronoa', series: 'One Piece', forms: [
    F('wano', 'King of Hell (Wano)', 'Wano', '5-C', 1, 8, 4, 10, ['haki'], ['Beat King', 'Scarred Kaido'], ['No sense of direction'], 'Moon level in Wano by most scalers.'),
  ] },
  { id: 'shanks', name: 'Shanks', search: 'Shanks', series: 'One Piece', forms: [
    F('shanks', 'Emperor Shanks', 'Final Saga', 'Low 5-B', 2, 8, 9, 9, ['haki', 'precog'], ['Divine Departure one-shot Kid', 'Advanced Observation Haki'], ['One arm'], 'Reddit has him as the strongest in OP right now.'),
  ] },
  { id: 'kaido', name: 'Kaido', search: 'Kaidou', series: 'One Piece', forms: [
    F('kaido', 'Hybrid / Dragon', 'Wano', '5-B', 1, 8, 6, 10, ['haki', 'fly'], ['Strongest creature', 'Survived countless executions'], ['Gets drunk'], 'Planet-level with Conqueror\'s haki at full power.'),
  ] },
  { id: 'imu', name: 'Imu', search: 'Imu', series: 'One Piece', forms: [
    F('imu', 'Imu (Mother Flame)', 'Final Saga', '5-B', 2, 8, 9, 9, ['haki', 'mind', 'immortal', 'conceptual'], ['Wiped Lulusia off the map', 'Controls the Elders'], ['Speculative: barely shown fighting'], 'Speculative tier: VSB has no profile yet. Reddit splits on it.'),
  ] },
  // ===================== Naruto =====================
  { id: 'naruto', name: 'Naruto', search: 'Naruto Uzumaki', series: 'Naruto', forms: [
    F('p1', 'Part 1 (1-tail cloak)', 'Part I', '7-B', 0, 5, 4, 9, ['regen'], ['Beat Gaara & Neji'], ['Reckless'], 'City level.'),
    F('sage', 'Sage Mode', 'Pain Arc', '6-B', 0, 6, 6, 9, ['regen'], ['Beat Pain'], ['Needs to stay still to gather chakra'], 'Country level.'),
    F('kcm', 'Kurama Mode', 'War Arc', 'High 6-A', 0, 7, 6, 10, ['regen', 'fly'], ['Tailed Beast Bombs'], ['Burns chakra'], 'Multi-continental.'),
    F('sm6p', 'Six Paths Sage Mode', 'Final War', '5-B', 2, 8, 7, 10, ['regen', 'fly', 'sealing', 'soul'], ['Fought Kaguya', 'Asura Avatar'], [], 'Planet level in VSB; Reddit often scales higher.'),
    F('baryon', 'Baryon Mode', 'Boruto', '5-B', 3, 9, 7, 6, ['regen', 'fly', 'soul'], ['Shredded Isshiki\'s life force'], ['Burns his own lifespan'], 'Boruto peak; Baryon vs Gear 5 is a classic Reddit war.'),
  ] },
  { id: 'sasuke', name: 'Sasuke', search: 'Sasuke Uchiha', series: 'Naruto', forms: [
    F('ems', 'EMS Perfect Susanoo', 'War Arc', '6-B', 2, 7, 8, 8, ['mind', 'precog', 'durneg'], ['Amaterasu black flames', 'Perfect Susanoo'], ['Eye strain'], 'Country level with huge hax.'),
    F('rinne', 'Six Paths Rinnegan', 'Final Battle', '5-B', 2, 8, 9, 9, ['mind', 'precog', 'tele', 'sealing', 'durneg'], ['Indra\'s Arrow', 'Amenotejikara swaps'], [], 'Equal to SM6P Naruto.'),
  ] },
  { id: 'madara', name: 'Madara', search: 'Madara Uchiha', series: 'Naruto', forms: [
    F('jubi', 'Ten-Tails Jinchuriki', 'War Arc', '5-B', 1, 8, 9, 10, ['mind', 'precog', 'sealing', 'regen', 'soul', 'fly'], ['Infinite Tsukuyomi', 'Limbo clones'], ['Arrogant'], 'Hax-heavy planet-level.'),
  ] },
  { id: 'itachi', name: 'Itachi', search: 'Itachi Uchiha', series: 'Naruto', forms: [
    F('edo', 'Edo Itachi', 'War Arc', '6-B', 1, 6, 10, 10, ['mind', 'sealing', 'immortal', 'precog'], ['Totsuka blade seals', 'Izanami loop'], ['Low raw power for the tier'], 'Reddit\'s favourite "Itachi solos with prep" meme.'),
  ] },
  // ===================== Bleach =====================
  { id: 'ichigo', name: 'Ichigo', search: 'Ichigo Kurosaki', series: 'Bleach', forms: [
    F('ss', 'Bankai (Soul Society)', 'Soul Society Arc', '6-B', 0, 7, 5, 8, ['soul'], ['Beat Byakuya'], ['Inexperienced'], 'Country level.'),
    F('mugetsu', 'Final Getsuga (Mugetsu)', 'Fake Karakura', 'High 6-A', 2, 9, 5, 4, ['soul'], ['Beat Hogyoku Aizen'], ['Loses his powers after'], 'One-shot nuke. Debated how far it scales.'),
    F('tybw', 'True Bankai', 'TYBW', '3-B', 1, 10, 6, 8, ['soul', 'soulres', 'regen'], ['Fought Almighty Yhwach'], ['Can be outsmarted'], 'Bleach is famous for scaling way above JJK and MHA.'),
  ] },
  { id: 'aizen', name: 'Aizen', search: 'Sousuke Aizen', series: 'Bleach', forms: [
    F('kyoka', 'Captain (Kyoka Suigetsu)', 'Soul Society Arc', 'High 6-A', 0, 8, 10, 9, ['mind', 'soul'], ['Perfect hypnosis'], ['Overconfident'], 'Complete hypnosis is elite hax.'),
    F('hogyoku', 'Hogyoku Final Form', 'Fake Karakura', '3-B', 0, 10, 10, 10, ['mind', 'soul', 'regen', 'immortal'], ['Immortal via Hogyoku'], ['Can be sealed'], 'Multi-galaxy in VSB; Reddit puts Aizen near the top of shonen.'),
  ] },
  { id: 'yhwach', name: 'Yhwach', search: 'Yhwach', series: 'Bleach', forms: [
    F('almighty', 'The Almighty (Soul King)', 'TYBW', '3-A', 1, 11, 9, 10, ['soul', 'soulres', 'futuresight', 'copy', 'regen', 'conceptual'], ['Sees and rewrites every future', 'Absorbed the Soul King'], ['Ichigo\'s Bankai sliced him'], 'Universe level. The Almighty is a nightmare matchup.'),
  ] },
  // ===================== Jujutsu Kaisen =====================
  { id: 'gojo', name: 'Gojo', search: 'Satoru Gojou', series: 'Jujutsu Kaisen', forms: [
    F('past', 'Hidden Inventory Gojo', 'Past Arc', 'High 7-C', 1, 7, 9, 8, ['infinity', 'regen', 'tele'], ['Awakened after Toji'], ['Arrogant'], 'Town-plus with Purple.'),
    F('present', 'Honored One (Purple)', 'Culling Game', '7-B', 1, 8, 10, 8, ['infinity', 'regen', 'domain', 'mind', 'tele', 'fly'], ['200% Purple', 'Unlimited Void info overload'], ['Infinity can be bypassed by space-cutting'], 'VSB city-level; Reddit agrees on Infinity hax, but he\'s low on raw power.'),
  ] },
  { id: 'sukuna', name: 'Sukuna', search: 'Sukuna', series: 'Jujutsu Kaisen', forms: [
    F('15', '15 Fingers (Megumi body)', 'Shinjuku', 'High 7-C', 1, 8, 10, 9, ['regen', 'domain', 'durneg', 'spacecut'], ['World Cutting Slash killed Gojo'], [], 'The guy who beat Gojo.'),
    F('full', 'Heian Form (20 fingers)', 'Shinjuku', '7-B', 1, 8, 10, 10, ['regen', 'domain', 'durneg', 'spacecut', 'soul'], ['Malevolent Shrine', 'Divine Flame'], ['Arrogant'], 'Top tier in JJK.'),
  ] },
  { id: 'yuji', name: 'Yuji Itadori', search: 'Yuuji Itadori', series: 'Jujutsu Kaisen', forms: [
    F('shib', 'Shibuya Black Flash', 'Shibuya', '8-B', 1, 6, 5, 9, [], ['Black Flash chain vs Mahito'], [], 'City block.'),
    F('final', 'Final Battle', 'Shinjuku', 'High 7-C', 1, 7, 6, 10, ['soul', 'regen', 'domain'], ['Soul-hitting punches on Sukuna'], [], 'Soul hits are his calling card.'),
  ] },
  // ===================== Black Clover =====================
  { id: 'asta', name: 'Asta', search: 'Asta', series: 'Black Clover', forms: [
    F('black', 'Black Asta', 'Royal Knights', '6-B', 0, 7, 3, 10, ['antimagic'], ['Cut down Zagred'], ['Can\'t use magic'], 'Anti-magic is a hard counter to magic users.'),
    F('jd', 'Devil Union (Judgement Day)', 'Judgement Day', 'High 6-A', 1, 8, 4, 10, ['antimagic', 'durneg'], ['Beat Lucifero'], ['No ranged magic'], 'Beat a top devil; anti-magic hax intact.'),
  ] },
  { id: 'yuno', name: 'Yuno', search: 'Yuno', series: 'Black Clover', forms: [
    F('zephyr', 'Spirit of Zephyr', 'Judgement Day', 'High 6-A', 1, 9, 7, 8, ['magic', 'fly', 'spacecut'], ['Star Magic', 'Spirit Dive'], ['Magic: weak to anti-magic'], 'Fastest Black Clover top tier.'),
  ] },
  // ===================== My Hero Academia =====================
  { id: 'deku', name: 'Deku', search: 'Izuku Midoriya', series: 'My Hero Academia', forms: [
    F('100', 'OFA 100% (all quirks)', 'Final War', 'High 6-B', 1, 7, 7, 7, ['fly', 'precog'], ['Beat Shigaraki with 100%'], ['Body breaks under strain'], 'Large country level.'),
  ] },
  { id: 'afo', name: 'All For One', search: 'All For One', series: 'My Hero Academia', forms: [
    F('fw', 'Rewind All For One', 'Final War', 'High 6-A', 0, 7, 9, 8, ['copy', 'regen', 'fly'], ['Hundreds of stolen quirks'], ['Rewind kills him over time'], 'Scaled via the Rewind drug.'),
  ] },
  // ===================== Demon Slayer =====================
  { id: 'tanjiro', name: 'Tanjiro', search: 'Tanjirou Kamado', series: 'Demon Slayer', forms: [
    F('mark', 'Demon Slayer Mark + Sun Breathing', 'Final Battle', '7-C', 1, 6, 6, 8, ['precog'], ['Fought Muzan to sunrise'], ['Human durability'], 'Town level.'),
  ] },
  { id: 'muzan', name: 'Muzan', search: 'Muzan Kibutsuji', series: 'Demon Slayer', forms: [
    F('final', 'Final Form', 'Final Battle', '7-C', 2, 6, 8, 10, ['regen', 'immortal', 'poison'], ['Regenerated almost instantly'], ['Dies to sunlight'], 'Weak to sunlight and Nichirin blades.'),
  ] },
  { id: 'yoriichi', name: 'Yoriichi', search: 'Yoriichi Tsugikuni', series: 'Demon Slayer', forms: [
    F('prime', 'Sun Breathing Prime', 'Flashback', '7-C', 2, 7, 8, 9, ['precog', 'durneg'], ['Nearly killed Muzan at 1,800 cuts'], ['Human body'], 'Strongest Demon Slayer character, no contest.'),
  ] },
  // ===================== AoT =====================
  { id: 'levi', name: 'Levi', search: 'Levi', series: 'Attack on Titan', forms: [
    F('odm', 'ODM + Thunder Spears', 'Marley', '8-B', 1, 5, 7, 7, [], ['Cut down the Beast Titan'], ['Human'], 'Peak human with ODM gear.'),
  ] },
  { id: 'eren', name: 'Eren', search: 'Eren Yeager', series: 'Attack on Titan', forms: [
    F('founder', 'Founding Titan (Rumbling)', 'Final Arc', '7-A', 0, 3, 7, 10, ['summon', 'mind', 'conceptual'], ['Rumbling', 'Path memory edits'], ['Slow'], 'Wall titans flatten everything; no Reddit consensus on pure power.'),
  ] },
  // ===================== Chainsaw Man =====================
  { id: 'denji', name: 'Denji', search: 'Denji', series: 'Chainsaw Man', forms: [
    F('csm', 'Hybrid Chainsaw', 'Part 1', '8-A', 0, 5, 3, 8, ['regen', 'immortal'], ['Beat Katana Man & Bomb Girl'], ['Blood loss'], 'Multi-city block.'),
  ] },
  { id: 'pochita', name: 'Chainsaw Man (Pochita)', search: 'Pochita', series: 'Chainsaw Man', forms: [
    F('true', 'True Form', 'Part 1', '7-B', 1, 7, 6, 10, ['erase', 'regen', 'immortal'], ['Eats devils out of existence'], [], 'Existence erasure gives him the edge in hax wars.'),
  ] },
  { id: 'makima', name: 'Makima', search: 'Makima', series: 'Chainsaw Man', forms: [
    F('control', 'Control Devil', 'Part 1', '7-C', 1, 6, 10, 9, ['mind', 'immortal', 'summon'], ['Contract with the PM', 'Pointer gun'], ['Only loves Chainsaw Man'], 'Hax-heavy, low on raw stats.'),
  ] },
  // ===================== HxH =====================
  { id: 'gon', name: 'Gon', search: 'Gon Freecss', series: 'Hunter x Hunter', forms: [
    F('adult', 'Adult Gon', 'Chimera Ant', '7-B', 0, 6, 3, 7, [], ['One-shot Pitou'], ['Loses his Nen after'], 'City level for one fight.'),
  ] },
  { id: 'killua', name: 'Killua', search: 'Killua Zoldyck', series: 'Hunter x Hunter', forms: [
    F('godspeed', 'Godspeed', 'Chimera Ant', '8-A', 1, 7, 8, 7, ['precog'], ['Godspeed reaction speed'], ['Battery runs out'], 'Speedster.'),
  ] },
  { id: 'meruem', name: 'Meruem', search: 'Meruem', series: 'Hunter x Hunter', forms: [
    F('post', 'Post-Rose', 'Chimera Ant', '7-A', 1, 7, 10, 10, ['copy', 'regen'], ['Survived the Poor Man\'s Rose'], ['Poisoned'], 'Mountain level.'),
  ] },
  // ===================== OPM =====================
  { id: 'saitama', name: 'Saitama', search: 'Saitama', series: 'One Punch Man', forms: [
    F('serious', 'Serious Saitama', 'Post-Garou', '4-A', 1, 10, 5, 12, [], ['Punched Jupiter apart', 'Time travel punch'], ['Gets bored'], 'Multi-solar system; Reddit says "Saitama wins by plot".'),
  ] },
  { id: 'garou', name: 'Garou', search: 'Garou', series: 'One Punch Man', forms: [
    F('cosmic', 'Cosmic Fear Mode', 'Monster Association', '4-A', 0, 10, 7, 10, ['copy', 'tele'], ['Copied Saitama'], ['Weak to Saitama'], 'Matched serious Saitama briefly.'),
  ] },
  // ===================== Dandadan =====================
  { id: 'okarun', name: 'Okarun', search: 'Ken Takakura', series: 'Dandadan', forms: [
    F('turbo', 'Turbo Granny Form', 'Dandadan', '8-C', 0, 7, 5, 6, [], ['Supersonic dashes'], ['Time limit'], 'Fast but low tier.'),
  ] },
  { id: 'momo', name: 'Momo', search: 'Momo Ayase', series: 'Dandadan', forms: [
    F('awak', 'Psychokinesis Awakening', 'Dandadan', '8-C', 0, 5, 6, 6, ['mind'], ['Grabs spirits'], [], 'Building level.'),
  ] },
  // ===================== JoJo =====================
  { id: 'johnny', name: 'Johnny Joestar', search: 'Johnny Joestar', series: "JoJo's Bizarre Adventure", forms: [
    F('act4', 'Tusk Act 4', 'Steel Ball Run', '8-C', 1, 7, 8, 6, ['erase', 'durneg', 'conceptual'], ['Infinite rotation hits across dimensions'], ['Paraplegic'], 'Low stats, ridiculous hax.'),
  ] },
  { id: 'jotaro', name: 'Jotaro', search: 'Joutarou Kuujou', series: "JoJo's Bizarre Adventure", forms: [
    F('sp', 'Star Platinum: The World', 'Stardust Crusaders', 'High 8-C', 0, 8, 8, 7, ['timestop', 'timemove'], ['Beat DIO'], ['Human'], 'Time stop is a trump card.'),
  ] },
  // ===================== Sakamoto Days =====================
  { id: 'sakamoto', name: 'Sakamoto', search: 'Tarou Sakamoto', series: 'Sakamoto Days', forms: [
    F('prime', 'Prime Sakamoto', 'Flashbacks', 'High 8-C', 1, 6, 9, 8, ['precog'], ['Legendary hitman'], ['Human'], 'Peak human.'),
  ] },
  // ===================== Solo Leveling =====================
  { id: 'sjw', name: 'Sung Jinwoo', search: 'Jinwoo Sung', series: 'Solo Leveling', forms: [
    F('monarch', 'Shadow Monarch', 'Final Arc', 'Low 6-B', 2, 8, 8, 10, ['summon', 'immortal', 'stealth', 'regen'], ['Shadow army', 'Beat the Monarchs'], [], 'VSB is conservative; Reddit scales him far higher.'),
  ] },
  // ===================== Other =====================
  { id: 'ed', name: 'Edward Elric', search: 'Edward Elric', series: 'Fullmetal Alchemist', forms: [
    F('ed', 'State Alchemist', 'Brotherhood', '8-C', 1, 5, 9, 7, ['conceptual'], ['Alchemy on the fly'], ['Human'], 'Smart fighter with alchemy hax.'),
  ] },
  { id: 'kaneki', name: 'Kaneki', search: 'Ken Kaneki', series: 'Tokyo Ghoul', forms: [
    F('dragon', 'Dragon', 'Tokyo Ghoul:re', '7-C', 1, 6, 6, 10, ['regen', 'immortal', 'summon'], ['Ate the dragon kagune'], [], 'Town plus.'),
  ] },
  { id: 'rimuru', name: 'Rimuru', search: 'Rimuru Tempest', series: 'Slime Isekai', forms: [
    F('ultimate', 'Ultimate Slime (God)', 'Light Novel', '1-C', 0, 12, 10, 12, ['erase', 'copy', 'regen', 'immortal', 'conceptual', 'summon'], ['Beelzebuth', 'Time-stop immunity'], [], 'Complex multiversal. Out of league here.'),
  ] },
  { id: 'anos', name: 'Anos', search: 'Anos Voldigoad', series: 'Misfit of Demon King Academy', forms: [
    F('unsup', 'Unsuppressed', 'Light Novel', 'Low 1-C', 1, 12, 10, 12, ['erase', 'conceptual', 'immortal', 'regen', 'magic'], ['Destroys destruction'], ['Holds back'], 'Low-complex multiversal; a power fantasy.'),
  ] },
]
