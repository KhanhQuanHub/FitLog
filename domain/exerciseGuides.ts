type Pose = { head: [number, number]; body: string; active: string; support?: string };

const standing: Pose = { head: [50, 15], body: 'M50 24V53 M50 53L41 70 38 88 M50 53L59 70 62 88', active: 'M50 30L38 33 33 47 30 58 M50 30L62 33 67 47 70 58' };
const seated: Pose = { head: [41, 19], body: 'M41 28L42 57 65 57 66 85 74 85', active: 'M41 34L51 49 62 53', support: 'M29 31V61H56 M33 61V88 M54 61V88' };
const lying: Pose = { head: [20, 77], body: 'M29 79L58 81', active: 'M32 79L49 87 M58 81L73 65 83 86 91 86' };
const lyingStraight: Pose = { ...lying, active: 'M32 79L49 87 M58 81L75 84 92 87' };
const kneeling: Pose = { head: [76, 46], body: 'M31 58L62 55 69 51', active: 'M62 55L64 72 64 87 71 87 M31 58L33 86 18 86' };
const wall = 'M88 21V89';

type Guide = { poses: [Pose, Pose]; setup: string; cue: string; alternating?: boolean };

export const EXERCISE_GUIDES: Record<string, Guide> = {
  'wall-push': {
    poses: [
      { head: [48, 22], body: 'M46 31L39 57 29 87H38', active: 'M46 37L66 42 87 42', support: wall },
      { head: [65, 25], body: 'M62 33L48 58 29 87H38', active: 'M62 40L73 52 87 42', support: wall },
    ],
    setup: 'Đứng cách tường khoảng một cánh tay, hai chân vững. Đặt lòng bàn tay lên tường ngang ngực.',
    cue: 'Hít vào khi tiến gần tường, thở ra khi đẩy về. Giữ đầu, hông và gót cùng một đường; tránh võng lưng.',
  },
  'chest-open': {
    poses: [standing, { ...standing, active: 'M50 30L37 31 25 34 12 29 M50 30L63 31 75 34 88 29' }],
    setup: 'Ngồi hoặc đứng thẳng, thả lỏng vai và để hai tay dọc thân.',
    cue: 'Mở tay tới khi thấy ngực căng nhẹ. Giữ xương sườn ổn định và tránh ngửa người ra sau.',
  },
  'dead-bug': {
    poses: [
      { ...lying, active: 'M34 79L34 46 M58 81L58 55 81 55' },
      { ...lying, active: 'M34 79L34 46 M35 79L11 66 M58 81L58 55 81 55 M58 81L89 72' },
    ],
    setup: 'Nằm ngửa, đưa hai tay lên trên vai. Nhấc chân để hông và gối co khoảng 90°.',
    cue: 'Thở ra khi hạ tay và chân đối diện. Dừng trước khi lưng dưới nhấc khỏi sàn; thu về rồi đổi bên.',
    alternating: true,
  },
  'belly-brace': {
    poses: [standing, { ...standing, active: 'M34 46L43 46 M66 46L57 46 M40 43L43 46 40 49 M60 43L57 46 60 49' }],
    setup: 'Ngồi hoặc đứng vững, thả vai. Có thể đặt nhẹ tay lên bụng để cảm nhận.',
    cue: 'Thở ra, siết nhẹ như chuẩn bị ho rồi thả lỏng. Giữ lưng yên và tiếp tục thở đều.',
  },
  'bird-dog': {
    poses: [kneeling, { ...kneeling, active: 'M62 55L79 52 93 52 M62 55L64 72 64 87 71 87 M31 58L33 86 18 86 M31 58L14 57 6 57' }],
    setup: 'Chống hai bàn tay dưới vai và hai đầu gối dưới hông. Nhìn xuống sàn.',
    cue: 'Vươn tay và chân đối diện trong tầm giữ hông cân. Thu về từ từ rồi đổi bên; tránh ngẩng đầu hoặc xoay hông.',
    alternating: true,
  },
  'shoulder-blade': {
    poses: [standing, { ...standing, active: 'M34 35L44 35 41 32 M44 35L41 38 M66 35L56 35 59 32 M56 35L59 38' }],
    setup: 'Ngồi hoặc đứng thẳng, buông hai tay và giữ cằm ngang.',
    cue: 'Kéo hai bả vai nhẹ về phía nhau rồi thả. Tránh nhún vai lên tai hoặc đẩy ngực quá xa.',
  },
  'wall-slide': {
    poses: [
      { ...standing, support: 'M24 20V89 M76 20V89', active: 'M50 30L34 43 30 29 M50 30L66 43 70 29' },
      { ...standing, support: 'M24 20V89 M76 20V89', active: 'M50 30L36 27 29 14 M50 30L64 27 71 14' },
    ],
    setup: 'Đứng sát tường, đặt hai tay lên tường trong tầm dễ chịu với khuỷu hơi gập.',
    cue: 'Trượt tay lên chậm rồi hạ về. Dừng trước khi vai nhún hoặc lưng dưới ưỡn.',
  },
  'shoulder-roll': {
    poses: [standing, { ...standing, active: 'M38 39C24 38 25 23 36 24L32 20 M36 24L32 28 M62 39C76 38 75 23 64 24L68 20 M64 24L68 28' }],
    setup: 'Đứng hoặc ngồi thẳng, để hai tay thả lỏng.',
    cue: 'Nhấc vai nhẹ, lăn ra sau rồi hạ xuống. Làm chậm, đổi chiều và giữ đầu yên.',
  },
  'arm-curl': {
    poses: [standing, { ...standing, active: 'M50 30L38 33 33 49 36 35 M50 30L62 33 67 49 64 35' }],
    setup: 'Đứng hoặc ngồi, cánh tay sát thân và lòng bàn tay hướng ra trước.',
    cue: 'Thở ra khi gập khuỷu, hạ chậm khi hít vào. Giữ cổ tay thẳng và tránh đung đưa người.',
  },
  'arm-extend': {
    poses: [standing, { ...standing, active: 'M50 30L38 33 33 49 36 35 M50 30L62 33 67 47 70 58' }],
    setup: 'Ngồi hoặc đứng thoải mái, giữ hai khuỷu gần thân.',
    cue: 'Gập rồi duỗi chậm một tay, sau đó đổi bên. Dừng trước khi khuỷu khóa cứng.',
    alternating: true,
  },
  bridge: {
    poses: [lying, { ...lying, body: 'M29 79L58 64', active: 'M32 79L49 87 M58 64L73 65 83 86 91 86' }],
    setup: 'Nằm ngửa, co gối, đặt hai bàn chân phẳng trên sàn rộng bằng hông.',
    cue: 'Ấn bàn chân xuống sàn và thở ra khi nâng hông. Dừng trước khi lưng ưỡn; hạ hông có kiểm soát.',
  },
  'glute-squeeze': {
    poses: [lying, { ...lying, active: 'M48 69L55 77 49 75 M66 73L60 78 61 72' }],
    setup: 'Nằm ngửa co gối hoặc ngồi vững với hai chân đặt trên sàn.',
    cue: 'Siết nhẹ cơ mông rồi thả lỏng. Giữ hông trên mặt tựa và không nín thở.',
  },
  'chair-squat': {
    poses: [seated, { ...standing, support: seated.support, head: [59, 15], body: 'M59 24V53 M59 53L62 71 65 87 74 87', active: 'M59 32L70 42 80 45' }],
    setup: 'Ngồi sát mép ghế chắc, không bánh xe. Đặt hai bàn chân phẳng, rộng bằng hông.',
    cue: 'Hơi nghiêng thân về trước khi đứng lên. Hạ người chậm đến ghế và giữ gối cùng hướng với mũi chân.',
  },
  'leg-extend': {
    poses: [seated, { ...seated, active: 'M65 57L87 63 88 55' }],
    setup: 'Ngồi vững trên ghế, giữ lưng thẳng và hai chân chạm sàn.',
    cue: 'Duỗi một gối tới tầm dễ chịu, hạ chân từ từ rồi đổi bên. Giữ đùi trên ghế và tránh khóa gối.',
    alternating: true,
  },
  'calf-raise': {
    poses: [
      { head: [40, 16], body: 'M40 25L42 54 45 86H55 M40 32L59 44 73 44', active: 'M45 71V86H55', support: 'M74 42V87 M74 66H94V87' },
      { head: [40, 11], body: 'M40 20L42 49 46 78 55 86 M40 27L59 44 73 44', active: 'M45 68L46 78 55 86', support: 'M74 42V87 M74 66H94V87' },
    ],
    setup: 'Đứng sau ghế chắc, đặt tay lên lưng ghế và đặt hai bàn chân song song.',
    cue: 'Nâng cả hai gót chậm rồi hạ về sàn. Tì tay vừa đủ để giữ thăng bằng và tránh lắc cổ chân.',
  },
  'ankle-pump': {
    poses: [{ ...seated, active: 'M66 85H81' }, { ...seated, active: 'M66 85L78 76 M80 84V73 M77 76L80 73 83 76' }],
    setup: 'Ngồi vững với gót chạm sàn, hai gối hướng về trước.',
    cue: 'Nâng mũi chân rồi hạ. Tiếp đó nâng gót, để mũi chân chạm sàn, rồi hạ. Cả chuỗi tính một lần.',
  },
  'side-brace': {
    poses: [standing, { ...standing, active: 'M32 46L43 46 39 42 M43 46L39 50 M68 46L57 46 61 42 M57 46L61 50' }],
    setup: 'Đứng hoặc ngồi thẳng. Có thể đặt hai tay ở hai bên eo.',
    cue: 'Thở ra khi siết nhẹ vùng bụng bên rồi thả lỏng. Giữ vai và hông hướng về trước.',
  },
  'triceps-extend': {
    poses: [
      { ...standing, active: 'M50 32L45 48 62 45' },
      { ...standing, active: 'M50 32L45 48 34 61' },
    ],
    setup: 'Đứng vững, gập nhẹ khuỷu và giữ phần cánh tay trên sát thân.',
    cue: 'Chỉ di chuyển cẳng tay khi duỗi ra sau rồi gập lại. Tránh vung vai hoặc ép khuỷu thẳng cứng.',
  },
  'wrist-curl': {
    poses: [
      { ...seated, active: 'M43 39L50 54 69 53 81 53' },
      { ...seated, active: 'M43 39L50 54 69 53 79 45' },
    ],
    setup: 'Ngồi, tựa cẳng tay lên đùi và để bàn tay nhô qua đầu gối.',
    cue: 'Gập và duỗi nhẹ ở cổ tay, giữ cẳng tay yên. Đổi tay sau mỗi lượt; không cần tạ.',
    alternating: true,
  },
  'shoulder-shrug': {
    poses: [standing, { ...standing, active: 'M50 28L37 26 33 44 30 55 M50 28L63 26 67 44 70 55' }],
    setup: 'Ngồi hoặc đứng thẳng, hai tay buông lỏng và mắt nhìn thẳng.',
    cue: 'Nâng nhẹ cả hai vai rồi hạ xuống chậm. Giữ cổ thư giãn và tránh xoay vai thành vòng.',
  },
  'seated-posture': {
    poses: [seated, { ...seated, active: 'M41 34L51 49 62 53 M34 33V53 M31 37L34 33 37 37' }],
    setup: 'Ngồi hoặc đứng vững, giữ đầu trên vai và vai trên hông.',
    cue: 'Giữ lưng trong tư thế tự nhiên trong vài nhịp thở rồi thả lỏng. Tránh ép lưng phẳng hoặc ưỡn sâu.',
  },
  'neck-turn': {
    poses: [standing, { ...standing, active: 'M42 15C48 9 57 9 63 15L59 11 M63 15L58 17 M50 30H36 M50 30H64' }],
    setup: 'Ngồi hoặc đứng thẳng, thả vai và giữ cằm ngang.',
    cue: 'Quay đầu chậm sang một bên rồi về giữa và đổi bên. Giữ vai yên, chỉ quay trong tầm dễ chịu.',
    alternating: true,
  },
  'heel-drag': {
    poses: [
      { ...seated, body: 'M41 28L42 57H65', active: 'M65 57L79 86 88 86' },
      { ...seated, body: 'M41 28L42 57H65', active: 'M65 57L63 86 72 86 M86 78H74L78 74 M74 78L78 82' },
    ],
    setup: 'Ngồi trên ghế chắc, đặt một gót hơi ra trước và giữ chân kia ổn định.',
    cue: 'Kéo gót về phía ghế nhẹ nhàng rồi đưa về chỗ cũ. Đổi bên và giữ thân yên.',
    alternating: true,
  },
  'adductor-squeeze': {
    poses: [
      { head: [50, 20], body: 'M50 29V57', active: 'M50 57L30 67 31 86 M50 57L70 67 69 86', support: 'M26 59H74 M27 59V88 M73 59V88' },
      { head: [50, 20], body: 'M50 29V57', active: 'M50 57L42 67 31 86 M50 57L58 67 69 86', support: 'M26 59H74 M27 59V88 M73 59V88' },
    ],
    setup: 'Ngồi vững, hai bàn chân chạm sàn và hai gối mở vừa phải.',
    cue: 'Đưa hai gối nhẹ về phía nhau rồi thả ra. Giữ bàn chân ổn định và tránh cố ép sát.',
  },
  'toe-raise': {
    poses: [{ ...seated, active: 'M66 85H81' }, { ...seated, active: 'M66 85L78 75' }],
    setup: 'Ngồi thoải mái, để hai gót chạm sàn.',
    cue: 'Nâng mũi chân về phía ống chân rồi hạ chậm. Giữ gót trên sàn và tránh nhấc cả chân.',
  },
  'lying-quad': {
    poses: [lyingStraight, { ...lyingStraight, active: 'M58 81L75 84 92 87 M72 69V79 M69 76L72 79 75 76' }],
    setup: 'Nằm ngửa, duỗi chân đang tập trong tầm thoải mái và thả vai.',
    cue: 'Siết mặt trước đùi để gối hướng nhẹ xuống mặt tựa rồi thả. Đổi bên và giữ nhịp thở đều.',
    alternating: true,
  },
  'lying-heel': {
    poses: [lying, { ...lying, active: 'M58 81L73 65 83 86 91 86 M87 69V81 M84 78L87 81 90 78' }],
    setup: 'Nằm ngửa, co nhẹ gối và đặt gót chân trên mặt tựa.',
    cue: 'Ấn một gót nhẹ xuống, thả rồi đổi chân. Giữ hông nằm yên trên mặt tựa.',
    alternating: true,
  },
  'lying-adductor': {
    poses: [
      { head: [50, 17], body: 'M50 26V52 M50 31L34 47 M50 31L66 47', active: 'M50 52L38 70 30 88 M50 52L62 70 70 88' },
      { head: [50, 17], body: 'M50 26V52 M50 31L34 47 M50 31L66 47', active: 'M50 52L46 71 44 88 M50 52L54 71 56 88' },
    ],
    setup: 'Nằm ngửa, để hai chân hơi tách trong tầm thoải mái. Hình minh họa nhìn từ trên xuống.',
    cue: 'Trượt hai chân nhẹ về gần nhau rồi trở về. Giữ hông trên mặt tựa và tránh cố ép hai chân sát.',
  },
};
