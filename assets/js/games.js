window.GAME_DATA = {
  categories: [
    {
      id: 'rpg',
      name: '角色扮演',
      tagline: '带上行囊，踏进故事',
      description: '探索像素世界，培养角色，让每一次冒险都留下进度。',
      accent: '#c6a56c',
      icon: 'spark'
    },
    {
      id: 'racing',
      name: '赛车',
      tagline: '极速狂飙，弯道超车',
      description: '公路躲避、弯道控车、精准换挡，用不同方式挑战速度。',
      accent: '#ff5d8f',
      icon: 'flag'
    },
    {
      id: 'action',
      name: '动作',
      tagline: '反应与操作的试炼',
      description: '紧张刺激的动作挑战，考验手速与判断。',
      accent: '#ffb347',
      icon: 'bolt'
    },
    {
      id: 'puzzle',
      name: '益智',
      tagline: '动动脑筋，破解谜题',
      description: '轻松烧脑的小谜题，灵感随时上线。',
      accent: '#5cc8ff',
      icon: 'puzzle'
    },
    {
      id: 'board',
      name: '桌游',
      tagline: '棋盘对弈，智取一局',
      description: '经典棋盘与棋子游戏，单人挑战或与朋友同屏对战。',
      accent: '#b493ff',
      icon: 'board'
    },
    {
      id: 'cards',
      name: '卡牌',
      tagline: '洗牌开局，牌桌见真章',
      description: '接龙、纸牌与牌桌游戏，随时来一局。',
      accent: '#ff8f6b',
      icon: 'cards'
    },
    {
      id: 'casual',
      name: '休闲',
      tagline: '随时开局，轻松一下',
      description: '没有压力的小游戏，碎片时间的好伙伴。',
      accent: '#7ce7a5',
      icon: 'leaf'
    },
    {
      id: 'music',
      name: '音乐',
      tagline: '跟随节拍，律动指尖',
      description: '踩着节奏敲击，感受指尖上的旋律。',
      accent: '#c08bff',
      icon: 'note'
    },
    {
      id: 'sports',
      name: '体育',
      tagline: '挥洒汗水，挑战极限',
      description: '把赛场搬进浏览器，来一场速战速决。',
      accent: '#ffd166',
      icon: 'ball'
    }
  ],
  games: [
    { id: 'bubble-shooter', title: '泡泡龙', category: 'casual', url: 'games/bubble-shooter/index.html?from=casual', cover: 'assets/images/covers/bubble-shooter.svg', tags: ['瞄准消除', '20 关', '自动存档', '触屏'], description: '瞄准发射同色泡泡，消除相连泡泡和悬空球群。不限时间，挑战二十个关卡。', badge: 'NEW', source: 'rembound/Bubble-Shooter-HTML5' },
    { id: 'match3', title: '宝石三消', category: 'casual', url: 'games/match3/index.html?from=casual', cover: 'assets/images/covers/match3.svg', tags: ['交换消除', '不限时', '关卡存档', '触屏'], description: '交换相邻宝石，连消得分并收集指定宝石。二十个步数关卡，无解自动重排。', badge: 'NEW', source: 'rembound/Match-3-Game-HTML5' },
    { id: 'packabunchas', title: '太空收纳', category: 'casual', url: 'games/packabunchas/index.html?from=casual', cover: 'assets/images/covers/packabunchas.svg', tags: ['收纳拼搭', '五种模式', '拼盘存档', '触屏'], description: '拖动旋转可爱的太空生物，把它们装进飞船。保留原作五种拼块模式，慢慢完成救援。', badge: 'NEW', source: 'MattiaFortunati/packabunchas' },
    { id: 'catchcat', title: '围住小猫', category: 'casual', url: 'games/catchcat/index.html?from=casual', cover: 'assets/images/covers/catchcat.svg', tags: ['围堵策略', '回合制', '撤销', '触屏'], description: '点击圆点设置障碍，提前封住小猫的逃生路线。二十关挑战，支持撤销与换局。', badge: 'NEW', source: 'ganlvtech/phaser-catch-the-cat' },
    { id: 'starfarm', title: '星砂牧场', category: 'rpg', url: 'games/starfarm/index.html?from=rpg', cover: 'assets/images/covers/starfarm.svg', tags: ['种植养成', '订单经营', '永久存档', '触屏'], description: '经营九格田园，建造厨房与鱼塘，完成八份订单，让牧场重新开张。', badge: 'NEW' },
    { id: 'runetraveler', title: '符文旅人', category: 'rpg', url: 'games/runetraveler/index.html?from=rpg', cover: 'assets/images/covers/runetraveler.svg', tags: ['牌组构筑', '九场试炼', '永久存档', '触屏'], description: '选择卡牌与遗物，观察敌人意图，穿过九场符文试炼。', badge: 'NEW' },
    { id: 'caravan', title: '口袋商队', category: 'rpg', url: 'games/caravan/index.html?from=rpg', cover: 'assets/images/covers/caravan.svg', tags: ['贸易经营', '五城商路', '永久存档', '触屏'], description: '低买高卖、运送委托、雇佣护卫，带领商队获得王都商路执照。', badge: 'NEW' },
    { id: 'wardens', title: '遗迹守望者', category: 'rpg', url: 'games/wardens/index.html?from=rpg', cover: 'assets/images/covers/wardens.svg', tags: ['回合战棋', '三人小队', '永久存档', '触屏'], description: '指挥剑卫、游侠和医师，用走位与配合守住六座遗迹。', badge: 'NEW' },
    { id: 'island', title: '荒岛手记', category: 'rpg', url: 'games/island/index.html?from=rpg', cover: 'assets/images/covers/island.svg', tags: ['采集制作', '荒岛生存', '永久存档', '触屏'], description: '从海滩拾荒起步，探索四片地区，收集航海手记并修船归乡。', badge: 'NEW' },
    { id: 'magictower', title: '百层魔塔', category: 'rpg', url: 'games/magictower/index.html?from=rpg', cover: 'assets/images/covers/magictower.svg', tags: ['数值策略', '百层探索', '永久存档', '触屏'], description: '计算战斗损伤、收集宝石与钥匙，击败十位守层者并解除百层封印。', badge: 'NEW' },
    { id: 'bounce-back', title: 'Bounce Back 回旋冒险', category: 'action', url: 'games/bounce-back/index.html?from=action', cover: 'assets/images/covers/bounce-back.svg', tags: ['回旋镖', '十层冒险', '关卡存档', '触屏'], description: 'Frank Force 的回旋镖冒险原作：购买装备、冲刺躲避，挑战最终首领。新增手机操作与关卡检查点。', badge: 'NEW', source: 'js13kGames/bounce-back' },
    { id: 'entombed', title: 'Entombed 地穴逃生', category: 'rpg', url: 'games/entombed/index.html?from=rpg', cover: 'assets/images/covers/entombed.svg', tags: ['第一人称', '地穴探索', '进度存档', '触屏'], description: '探索像素地穴，击败幽灵夺取钥匙，找到梯子逃出生天。原作新增手机转向和进度恢复。', badge: 'NEW', source: 'beeglebug/js13k-19' },
    {
      id: 'fogtown',
      title: '雾灯镇：遗迹之钥',
      subtitle: '点亮灯塔，让迷途的人回家',
      category: 'rpg',
      url: 'games/fogtown/index.html?from=rpg',
      cover: 'assets/images/covers/fogtown.svg',
      tags: ['像素 RPG', '回合制', '长期存档', '触屏'],
      description: '探索森林、矿洞与古代遗迹，收集三枚钥印，重新点亮雾灯镇。升级、装备、支线与完整主线，自动保存冒险进度。',
      badge: 'NEW'
    },
    {
      id: 'crazy-racing',
      title: '疯狂的赛车',
      subtitle: '在时间耗尽前，冲过终点',
      category: 'racing',
      url: 'games/racing/crazy-racing.html',
      cover: 'assets/images/covers/crazy-racing.jpg',
      tags: ['竞速', '躲避', '时间挑战', '触屏支持'],
      description: '在弯曲的公路上躲避来车，用剩余时间续命。越跑越远，刷新你的总里程。',
      featured: true,
      badge: 'NEW'
    },
    {
      id: 'circuit',
      title: '弯道计时赛',
      category: 'racing',
      url: 'games/circuit/index.html?from=racing',
      cover: 'assets/images/covers/circuit.svg',
      tags: ['俯视驾驶', '刹车过弯', '三圈计时', '触屏'],
      description: '控制车头、刹车过弯，按顺序穿过检查点，在 90 秒内跑完三圈。',
      badge: 'NEW'
    },
    {
      id: 'drag-race',
      title: '极速换挡',
      category: 'racing',
      url: 'games/drag-race/index.html?from=racing',
      cover: 'assets/images/covers/drag-race.svg',
      tags: ['直线加速', '换挡时机', '氮气', '触屏'],
      description: '盯紧转速甜区，精准换挡、释放氮气，赢下 400 米直线加速对决。',
      badge: 'NEW'
    },
    {
      id: 'tower-defence',
      title: '塔防',
      category: 'action',
      url: 'games/tower-defence/index.html?from=action',
      cover: 'assets/images/covers/tower-defence.jpg',
      tags: ['塔防', '升级', '二十波'],
      description: '建造并升级防御塔，撑过二十波进攻。',
      badge: 'HOT',
      source: 'chogan'
    },
    {
      id: 'breakout',
      title: '打砖块',
      category: 'action',
      url: 'games/breakout/index.html?from=action',
      cover: 'assets/images/covers/breakout.jpg',
      tags: ['打砖块', '挡板', '反应'],
      description: '十二面砖墙，用一根手指拖动挡板。',
      source: 'chogan'
    },
    {
      id: 'blockdrop',
      title: '落块',
      category: 'action',
      url: 'games/blockdrop/index.html?from=action',
      cover: 'assets/images/covers/blockdrop.jpg',
      tags: ['落块', '消行', '街机'],
      description: '旋转下落的方块并消行：40 行竞速或 100 行马拉松。',
      source: 'chogan'
    },
    {
      id: 'gorillas',
      title: '大猩猩',
      category: 'action',
      url: 'games/gorillas/index.html?from=action',
      cover: 'assets/images/covers/gorillas.jpg',
      tags: ['大猩猩', '抛物线', '双人'],
      description: '从屋顶扔出爆炸香蕉：角度、力度和风。对战电脑或双人。',
      source: 'chogan'
    },
    {
      id: 'tanks',
      title: '坦克',
      category: 'action',
      url: 'games/tanks/index.html?from=action',
      cover: 'assets/images/covers/tanks.jpg',
      tags: ['坦克', '抛物线', '双人'],
      description: '隔着山丘向对方坦克开火：角度、力度、风和五种武器。',
      source: 'chogan'
    },
    {
      id: 'hop',
      title: '跳跳',
      category: 'action',
      url: 'games/hop/index.html?from=action',
      cover: 'assets/images/covers/hop.jpg',
      tags: ['跳跃', '平台', '触屏'],
      description: '从一个平台跳到另一个平台，别掉下去；触摸或倾斜手机操作。',
      source: 'chogan'
    },
    {
      id: 'sudoku',
      title: '数独',
      category: 'puzzle',
      url: 'games/sudoku/index.html?from=puzzle',
      cover: 'assets/images/covers/sudoku.jpg',
      tags: ['数独', '逻辑', '每日挑战'],
      description: '四种难度，笔记、提示和每日挑战。',
      badge: 'DAILY',
      source: 'chogan'
    },
    {
      id: 'minesweeper',
      title: '扫雷',
      category: 'puzzle',
      url: 'games/minesweeper/index.html?from=puzzle',
      cover: 'assets/images/covers/minesweeper.jpg',
      tags: ['扫雷', '推理', '经典'],
      description: '不靠猜测扫清雷区。',
      source: 'chogan'
    },
    {
      id: 'mahjong',
      title: '麻将接龙',
      category: 'puzzle',
      url: 'games/mahjong/index.html?from=puzzle',
      cover: 'assets/images/covers/mahjong.jpg',
      tags: ['麻将', '配对', '清空牌桌'],
      description: '配对可拿的相同牌，直到清空牌桌。每一局都有解。',
      badge: 'HOT',
      source: 'chogan'
    },
    {
      id: 'jigsaw',
      title: '拼图',
      category: 'puzzle',
      url: 'games/jigsaw/index.html?from=puzzle',
      cover: 'assets/images/covers/jigsaw.jpg',
      tags: ['拼图', '拖拽', '风景'],
      description: '把拼块从下方一排拖上来拼完整张图，12 到 150 块，波斯图案和风景都是用代码画的。',
      badge: 'PICK',
      source: 'chogan'
    },
    {
      id: 'nonogram',
      title: '数织',
      category: 'puzzle',
      url: 'games/nonogram/index.html?from=puzzle',
      cover: 'assets/images/covers/nonogram.jpg',
      tags: ['数织', '逻辑', '图案'],
      description: '根据数字揭开隐藏的图案，无需猜测。',
      source: 'chogan'
    },
    {
      id: 'lights',
      title: '关灯',
      category: 'puzzle',
      url: 'games/lights/index.html?from=puzzle',
      cover: 'assets/images/covers/lights.jpg',
      tags: ['关灯', '连锁', '逻辑'],
      description: '每盏灯会切换自己和四个邻居；把灯全部熄灭。',
      source: 'chogan'
    },
    {
      id: 'pairs',
      title: '翻牌配对',
      category: 'puzzle',
      url: 'games/pairs/index.html?from=puzzle',
      cover: 'assets/images/covers/pairs.jpg',
      tags: ['翻牌', '配对', '记忆'],
      description: '每次翻开两张牌，用最少的步数找出所有配对。',
      source: 'chogan'
    },
    {
      id: 'simon',
      title: '闪灯记忆',
      category: 'puzzle',
      url: 'games/simon/index.html?from=puzzle',
      cover: 'assets/images/covers/simon.jpg',
      tags: ['记忆', '闪灯', '节奏'],
      description: '彩色按键依次亮起，按同样的顺序重复。每轮多一个。',
      source: 'chogan'
    },
    {
      id: 'sliding',
      title: '数字华容道',
      category: 'puzzle',
      url: 'games/sliding/index.html?from=puzzle',
      cover: 'assets/images/covers/sliding.jpg',
      tags: ['数字华容道', '滑动', '步数'],
      description: '滑动数字方块，把它们排回顺序，从 3×3 到 5×5；步数越少越好。',
      source: 'chogan'
    },
    {
      id: 'bridges',
      title: '数桥',
      category: 'puzzle',
      url: 'games/bridges/index.html?from=puzzle',
      cover: 'assets/images/covers/bridges.jpg',
      tags: ['数桥', '连线', '逻辑'],
      description: '用桥连接岛屿，每道谜题只有一个答案。',
      source: 'chogan'
    },
    {
      id: 'mastermind',
      title: '猜密码',
      category: 'puzzle',
      url: 'games/mastermind/index.html?from=puzzle',
      cover: 'assets/images/covers/mastermind.jpg',
      tags: ['猜密码', '推理', '颜色'],
      description: '根据提示，在十次之内猜出颜色密码。',
      source: 'chogan'
    },
    {
      id: 'wayout',
      title: '出路',
      category: 'puzzle',
      url: 'games/wayout/index.html?from=puzzle',
      cover: 'assets/images/covers/wayout.jpg',
      tags: ['箭头', '顺序', '反应'],
      description: '箭头谜题：按可行的顺序把箭头送出棋盘；点到被挡住的箭头会失去一颗心。',
      source: 'chogan'
    },
    {
      id: 'gridlock',
      title: '堵车',
      category: 'puzzle',
      url: 'games/gridlock/index.html?from=puzzle',
      cover: 'assets/images/covers/gridlock.jpg',
      tags: ['华容道', '推车', '动脑'],
      description: '把挡路的车推开，把你的车开出停车场。',
      source: 'chogan'
    },
    {
      id: 'peg',
      title: '孔明棋',
      category: 'puzzle',
      url: 'games/peg/index.html?from=puzzle',
      cover: 'assets/images/covers/peg.jpg',
      tags: ['孔明棋', '跳吃', '益智'],
      description: '让棋子互相跳吃，直到只剩一枚。',
      source: 'chogan'
    },
    {
      id: 'chess',
      title: '国际象棋',
      category: 'board',
      url: 'games/chess/index.html?from=board',
      cover: 'assets/images/covers/chess.jpg',
      tags: ['国际象棋', '策略', '对战电脑'],
      description: '和三个难度的电脑对弈或两人共用一部手机，还有谜题。',
      badge: 'CLASSIC',
      source: 'chogan'
    },
    {
      id: 'xiangqi',
      title: '中国象棋',
      category: 'board',
      url: 'games/xiangqi/index.html?from=board',
      cover: 'assets/images/covers/xiangqi.jpg',
      tags: ['中国象棋', '策略', '双人'],
      description: '9×10 的中国象棋：九宫、象、炮与将帅照面；人机或双人对战。',
      badge: 'CLASSIC',
      source: 'chogan'
    },
    {
      id: 'gomoku',
      title: '五子棋',
      category: 'board',
      url: 'games/gomoku/index.html?from=board',
      cover: 'assets/images/covers/gomoku.jpg',
      tags: ['五子棋', '连珠', '双人'],
      description: '五子连珠：对战三个难度的电脑或双人对弈，棋盘 9、13 或 15 路。',
      source: 'chogan'
    },
    {
      id: 'go',
      title: '围棋',
      category: 'board',
      url: 'games/go/index.html?from=board',
      cover: 'assets/images/covers/go.jpg',
      tags: ['围棋', '围地', '策略'],
      description: '9×9 围棋：围地与提子，对战三个难度的电脑或双人对弈。',
      source: 'chogan'
    },
    {
      id: 'reversi',
      title: '黑白棋',
      category: 'board',
      url: 'games/reversi/index.html?from=board',
      cover: 'assets/images/covers/reversi.jpg',
      tags: ['黑白棋', '翻转', '对战电脑'],
      description: '夹住并翻转对手的棋子。双人对战或对战电脑。',
      source: 'chogan'
    },
    {
      id: 'checkers',
      title: '西洋跳棋',
      category: 'board',
      url: 'games/checkers/index.html?from=board',
      cover: 'assets/images/covers/checkers.jpg',
      tags: ['跳棋', '吃子', '对战电脑'],
      description: '斜着走，跳过去吃子，到底线升王；经典或西班牙规则。双人对战或对战电脑。',
      source: 'chogan'
    },
    {
      id: 'ludo',
      title: '飞行棋',
      category: 'board',
      url: 'games/ludo/index.html?from=board',
      cover: 'assets/images/covers/ludo.jpg',
      tags: ['飞行棋', '掷骰', '多人'],
      description: '掷骰子，六点出营，吃掉对手，把棋子先送回家；2到4人或对战电脑。',
      source: 'chogan'
    },
    {
      id: 'snakes',
      title: '蛇梯棋',
      category: 'board',
      url: 'games/snakes/index.html?from=board',
      cover: 'assets/images/covers/snakes.jpg',
      tags: ['蛇梯棋', '掷骰', '多人'],
      description: '掷骰子，爬梯子，碰蛇就滑下，先到100者胜；2到4人或对战电脑。',
      source: 'chogan'
    },
    {
      id: 'backgammon',
      title: '双陆棋',
      category: 'board',
      url: 'games/backgammon/index.html?from=board',
      cover: 'assets/images/covers/backgammon.jpg',
      tags: ['双陆棋', '掷骰', '对战电脑'],
      description: '完整双陆棋，双人或对战电脑。',
      source: 'chogan'
    },
    {
      id: 'mancala',
      title: '播棋',
      category: 'board',
      url: 'games/mancala/index.html?from=board',
      cover: 'assets/images/covers/mancala.jpg',
      tags: ['播棋', '双人', '对战电脑'],
      description: '播种吃子。双人对战或对战电脑。',
      source: 'chogan'
    },
    {
      id: 'dots',
      title: '点格棋',
      category: 'board',
      url: 'games/dots/index.html?from=board',
      cover: 'assets/images/covers/dots.jpg',
      tags: ['点格棋', '双人', '对战电脑'],
      description: '画线围格子。双人对战或对战电脑。',
      source: 'chogan'
    },
    {
      id: 'morris',
      title: '九子棋',
      category: 'board',
      url: 'games/morris/index.html?from=board',
      cover: 'assets/images/covers/morris.jpg',
      tags: ['九子棋', '成三', '对战电脑'],
      description: '连成三子吃掉对方一子。双人对战或对战电脑。',
      source: 'chogan'
    },
    {
      id: 'battleship',
      title: '海战棋',
      category: 'board',
      url: 'games/battleship/index.html?from=board',
      cover: 'assets/images/covers/battleship.jpg',
      tags: ['海战', '布阵', '猜位'],
      description: '布置舰队，抢先击沉对手的全部战舰。',
      source: 'chogan'
    },
    {
      id: 'chain',
      title: '连锁反应',
      category: 'board',
      url: 'games/chain/index.html?from=board',
      cover: 'assets/images/covers/chain.jpg',
      tags: ['连锁反应', '多人', '对战电脑'],
      description: '放球、引爆满格，把对手的颜色清出棋盘；2到4人同机对战或对战电脑。',
      source: 'chogan'
    },
    {
      id: 'corridor',
      title: '走廊',
      category: 'board',
      url: 'games/corridor/index.html?from=board',
      cover: 'assets/images/covers/corridor.jpg',
      tags: ['走廊', '围墙', '对战电脑'],
      description: '把棋子走到对面，用墙让对手绕远路。',
      source: 'chogan'
    },
    {
      id: 'linkup',
      title: '连桥',
      category: 'board',
      url: 'games/linkup/index.html?from=board',
      cover: 'assets/images/covers/linkup.jpg',
      tags: ['连桥', '路线', '多人'],
      description: '用桥连起你的两条边，同时挡住对手。',
      source: 'chogan'
    },
    {
      id: 'klondike',
      title: '克朗代克',
      category: 'cards',
      url: 'games/klondike/index.html?from=cards',
      cover: 'assets/images/covers/klondike.jpg',
      tags: ['克朗代克', '接龙', '纸牌'],
      description: '经典接龙：把每种花色从A排到K；每次翻一张或三张。',
      badge: 'CLASSIC',
      source: 'chogan'
    },
    {
      id: 'spider',
      title: '蜘蛛纸牌',
      category: 'cards',
      url: 'games/spider/index.html?from=cards',
      cover: 'assets/images/covers/spider.jpg',
      tags: ['蜘蛛纸牌', '接龙', '花色'],
      description: '把每种花色从K到A依次排好；单色、双色或四色。',
      source: 'chogan'
    },
    {
      id: 'freecell',
      title: '空当接龙',
      category: 'cards',
      url: 'games/freecell/index.html?from=cards',
      cover: 'assets/images/covers/freecell.jpg',
      tags: ['空当接龙', '纸牌', '经典'],
      description: '几乎每一局都能赢的单人纸牌。',
      source: 'chogan'
    },
    {
      id: 'blackjack',
      title: '二十一点',
      category: 'cards',
      url: 'games/blackjack/index.html?from=cards',
      cover: 'assets/images/covers/blackjack.jpg',
      tags: ['二十一点', '赌桌', '运气'],
      description: '比庄家更接近 21：十手一场，没有下注。',
      source: 'chogan'
    },
    {
      id: 'crazyeights',
      title: '疯狂八',
      category: 'cards',
      url: 'games/crazyeights/index.html?from=cards',
      cover: 'assets/images/covers/crazyeights.jpg',
      tags: ['疯狂八', '出牌', '对战电脑'],
      description: '跟花色或点数，用J换花色，躲开7的罚牌，抢先出完手牌；对战1到3个电脑。',
      source: 'chogan'
    },
    {
      id: 'ginrummy',
      title: '金拉米',
      category: 'cards',
      url: 'games/ginrummy/index.html?from=cards',
      cover: 'assets/images/covers/ginrummy.jpg',
      tags: ['金拉米', '组合', '对战电脑'],
      description: '组成组合，减少散牌，然后敲牌或达成金；对战电脑，先到100分。',
      source: 'chogan'
    },
    {
      id: 'hokm',
      title: '霍克姆',
      category: 'cards',
      url: 'games/hokm/index.html?from=cards',
      cover: 'assets/images/covers/hokm.jpg',
      tags: ['霍克姆', '叫牌', '四人'],
      description: '波斯四人纸牌霍克姆：你和搭档对战两名电脑对手。',
      source: 'chogan'
    },
    {
      id: 'shelem',
      title: '谢勒姆',
      category: 'cards',
      url: 'games/shelem/index.html?from=cards',
      cover: 'assets/images/covers/shelem.jpg',
      tags: ['谢勒姆', '叫分', '四人'],
      description: '带叫分的霍克姆：和搭档叫分，拿底牌定王牌；先到505分。',
      source: 'chogan'
    },
    {
      id: 'pasur',
      title: '帕苏尔',
      category: 'cards',
      url: 'games/pasur/index.html?from=cards',
      cover: 'assets/images/covers/pasur.jpg',
      tags: ['帕苏尔', '凑十一', '对战电脑'],
      description: '波斯钓鱼纸牌：凑成十一，清台得分，对战电脑。',
      source: 'chogan'
    },
    {
      id: '2048',
      title: '2048',
      category: 'casual',
      url: 'games/2048/index.html?from=casual',
      cover: 'assets/images/covers/2048.svg',
      tags: ['数字合并', '滑动', '自动存档'],
      description: '滑动棋盘合并相同数字，轻松挑战 2048；随时离开，下次接着玩。',
      badge: 'NEW'
    },
    {
      id: 'snake',
      title: '贪吃蛇',
      category: 'casual',
      url: 'games/snake/index.html?from=casual',
      cover: 'assets/images/covers/snake.svg',
      tags: ['经典', '方向键', '触屏'],
      description: '吃掉果实，让小蛇慢慢长大。三档速度，挑战自己的最长纪录。',
      badge: 'NEW'
    },
    {
      id: 'stack',
      title: '云端叠塔',
      category: 'casual',
      url: 'games/stack/index.html?from=casual',
      cover: 'assets/images/covers/stack.svg',
      tags: ['一键操作', '精准叠放', '连击', '触屏'],
      description: '看准时机放下移动方块，切掉多余部分。三连精准恢复宽度，挑战 30 层云端高塔。',
      badge: 'NEW'
    },
    {
      id: 'pitch',
      title: '音高侦探',
      category: 'music',
      url: 'games/pitch/index.html?from=music',
      cover: 'assets/images/covers/pitch.svg',
      tags: ['听音辨高低', '音感', '不限时', '视觉辅助'],
      description: '听两个音，判断第二个更高、更低还是相同。十二轮渐进音程，训练敏锐的耳朵。',
      badge: 'NEW'
    },
    {
      id: 'melody',
      title: '旋律拼图',
      category: 'music',
      url: 'games/melody/index.html?from=music',
      cover: 'assets/images/covers/melody.svg',
      tags: ['音乐解谜', '旋律重排', '试听', '不限时'],
      description: '把打乱的音符拼成完整旋律，试听、修改、查看乐谱，收集五张音乐明信片。',
      badge: 'NEW'
    },
    {
      id: 'rhythm',
      title: '节拍音符',
      category: 'music',
      url: 'games/rhythm/index.html?from=music',
      cover: 'assets/images/covers/rhythm.svg',
      tags: ['节奏', '四键', '原创旋律', '触屏'],
      description: '跟随原创合成旋律，在音符落到判定线时敲击四条轨道，争取全连。',
      badge: 'NEW'
    },
    {
      id: 'pingpong',
      title: '乒乓球',
      category: 'sports',
      url: 'games/pingpong/index.html?from=sports',
      cover: 'assets/images/covers/pingpong.jpg',
      tags: ['乒乓球', '对打', '先到 11 分'],
      description: '在球桌上把球打回去，直到它越过对方的球拍；先到 11 分。',
      badge: 'HOT',
      source: 'chogan'
    },
    {
      id: 'airhockey',
      title: '桌上冰球',
      category: 'sports',
      url: 'games/airhockey/index.html?from=sports',
      cover: 'assets/images/covers/airhockey.jpg',
      tags: ['桌上冰球', '霓虹', '七球制'],
      description: '在霓虹球台上把冰球打进对方球门，守住自己的球门；先进七球。',
      badge: 'NEON',
      source: 'chogan'
    },
    {
      id: 'eightball',
      title: '八球',
      category: 'sports',
      url: 'games/eightball/index.html?from=sports',
      cover: 'assets/images/covers/eightball.jpg',
      tags: ['台球', '八球', '对战电脑'],
      description: '先打进自己的一组球，最后打进 8 号球：对战三个难度的电脑或双人对战。',
      source: 'chogan'
    },
    {
      id: 'snooker',
      title: '斯诺克',
      category: 'sports',
      url: 'games/snooker/index.html?from=sports',
      cover: 'assets/images/covers/snooker.jpg',
      tags: ['斯诺克', '台球', '对战电脑'],
      description: '一个红球、一个彩球，最后按顺序打彩球：6、10 或 15 个红球的斯诺克，对战电脑或双人对战。',
      source: 'chogan'
    },
    {
      id: 'darts',
      title: '飞镖',
      category: 'sports',
      url: 'games/darts/index.html?from=sports',
      cover: 'assets/images/covers/darts.jpg',
      tags: ['飞镖', '501', '每日挑战'],
      description: '501或301，每轮三镖，以双倍区收镖；对战电脑或双人，还有每日挑战。',
      badge: 'DAILY',
      source: 'chogan'
    },
    {
      id: 'bowling',
      title: '保龄球',
      category: 'sports',
      url: 'games/bowling/index.html?from=sports',
      cover: 'assets/images/covers/bowling.jpg',
      tags: ['保龄球', '曲线球', '每日挑战'],
      description: '十格，滑动投球、弯曲加旋；单人、对战电脑或双人，还有每日球道。',
      badge: 'DAILY',
      source: 'chogan'
    }
  ]
};
