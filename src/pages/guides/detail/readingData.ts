export const readingGuide = {
  slug: "the-day-reading-changed",
  issue: "Guide 06",
  status: "Prologue now open",
  title: "The Day Reading Changed",
  lede: `"Books moved through our lives in ways that were informal, improvised, and occasionally rebellious. No one called this a reading culture. It was simply life."`,
  author: {
    name: "Wangari Karume",
    url: "https://wakilisha.africa/author/wangari/",
  },
  publisher: "WAKILISHA Books",
  shareUrl: "https://wakilisha.africa/guides/the-day-reading-changed/",
  shareTitle: "The Day Reading Changed | WAKILISHA Books",
  shareDescription:
    "A WAKILISHA literary project by Wangari Karume on the reading cultures that shaped a generation, and what fractured them.",
  coverImage:
    "https://wakilisha.africa/wp-content/plugins/wakilisha-v2.0.201-cpt-cleanup/assets/guides/share/kenyan-literary-scene-share.jpg",
  ogImage:
    "https://wakilisha.africa/wp-content/plugins/wakilisha-v2.0.201-cpt-cleanup/assets/guides/share/kenyan-literary-scene-share.jpg",
  nextChapter: {
    title: "Chapter One: The Library Era",
    subtitle:
      "The first full chapter follows the institutions, classrooms, shelves and informal routes that made books unavoidable.",
  },
  toc: [
    { id: "prologue", label: "Prologue", subtitle: "The Day Reading Changed", num: "P" },
    { id: "classroom-library", label: "The Classroom Library", num: "I" },
    { id: "home-ecosystem", label: "The Home Ecosystem", num: "II" },
    { id: "reading-ecosystem", label: "Reading as Infrastructure", num: "III" },
    { id: "smartphone-shift", label: "The Smartphone Shift", num: "IV" },
    { id: "return", label: "The Return", num: "V" },
    { id: "larger-question", label: "The Larger Question", num: "VI" },
  ],
};

export const prologueChapter = {
  label: "Prologue",
  num: "P",
  title: "The Day Reading Changed",
  epigraph: {
    text: "The home environment provides the child's first lessons in reading. Long before schools intervene, the rhythms of literacy are already taking shape.",
    cite: "1985 Commission on Reading",
  },
  paragraphs: [
    {
      isDropCap: true,
      html: `The book that refuses to leave me is <em>Requiem for a Glass Heart</em> by David L. Lindsey. I read it only once, borrowed from my English teacher. Yet that single encounter embedded itself somewhere deep in the recesses of young Wangari's mind. I have refused to download an online copy ever since. It would not read right.`,
    },
    {
      html: `There was something about the weight of it — the feel of turning the pages, the slow immersion into a world that unfolded at the pace of thought rather than the pace of notification. A book like that demanded patience. It also rewarded it.`,
    },
    {
      html: `Around that same time I encountered Ben Carson's <em>Gifted Hands</em>. In the years that followed, my primary-school reading life unfolded through a rotating cast of titles from the Heinemann African Writers Series and a handful from East African Educational Publishers. Somewhere along the way I also stumbled onto <em>Goosebumps</em>, borrowed from a classmate whose name I no longer remember but whose quiet contribution to my literary formation was enormous.`,
    },
    {
      html: `Another book etched into memory is Mwangi Gicheru's <em>Across the Bridge</em> — not because it was exceptional literature, but because it had been banned at school.`,
    },
    {
      html: `Naturally, most of us read it anyway. Take that, Mr. Njoroge.`,
    },
    {
      html: `Looking back now, what strikes me is not the individual titles but the strange and vibrant ecosystem through which they circulated. Books moved through our lives in ways that were informal, improvised, and occasionally rebellious. Teachers lent them. Friends smuggled them into classrooms. Parents stacked them on shelves at home. Someone's older sibling passed one along. A cousin left another behind during a visit.`,
    },
  ],
  pullQuote: `No one called this a "reading culture." It was simply life.`,
};

export const classroomLibrary = {
  id: "classroom-library",
  num: "I",
  title: "The Classroom Library",
  paragraphs: [
    {
      html: `Reading in school was not limited to English titles. My Kiswahili teacher, Mr. Mwambi, ran what could only be described as a disciplined classroom library. From a modest collection of about thirty books, the rule was simple: complete at least two every week.`,
    },
    {
      html: `At the time the demand felt almost unreasonable. Looking back, it was manageable — most titles barely exceeded three hundred pages. The real pressure was not the volume but the accountability.`,
    },
    {
      html: `Returning a book was never a quiet administrative exercise.`,
    },
    {
      html: `He would read some random line from the book then run to you and demand, "Fafanua mukhtadha wa dondoo hili." You did not simply claim to have read the book. You demonstrated it.`,
    },
    {
      html: `An unsatisfactory answer meant the book went straight back with you. Occasionally he would pull out his records and review our progress. Those who were "behind" were encouraged to improve their reading habits through the persuasive appearance of a metre-long black pipe — which had a curious habit of resurfacing during exam revision.`,
    },
    {
      html: `It was a brutal incentive structure, but an effective one.`,
    },
  ],
};

export const homeEcosystem = {
  id: "home-ecosystem",
  num: "II",
  title: "The Home Ecosystem",
  paragraphs: [
    {
      html: `At home my mother ensured reading material was never in short supply. Our small family library held health books, Bible stories, a few African novels, copies of <em>Taifa Leo</em>, and several aging editions of <em>Reader's Digest</em>. I also remember devouring <em>Tintin</em> and the now-mythical childhood comics <em>The Beano</em> and <em>The Dandy</em>, which seemed to circulate mysteriously among Kenyan households in the 1990s.`,
    },
  ],
  aside: {
    kicker: "A note on infrastructure",
    title: "The library that was never there",
    body: `The range was eclectic but constant. Print was simply there. Looking back, I realize something strange. In all my years of schooling, I never once set foot in the National Library. The schools I attended did not have functioning libraries either. The only exception was my high school — and even there I rarely used it.`,
  },
  paragraphsAfter: [
    {
      html: `Yet we read. Constantly.`,
    },
    {
      html: `Girls brought books from home and shared them in ways that now feel almost ingenious. Thick novels — Nora Roberts, Dan Brown — would be physically divided into three sections. The first third went to one reader, the middle to another, the final section to a third. Once someone finished their portion, the sections rotated.`,
    },
  ],
  pullQuote: `It was a crude but ruthlessly efficient literary supply chain.`,
  paragraphsAfterPull: [
    {
      html: `At the time it felt normal. Only later did I realize how unusual it was. Formal reading infrastructure — school libraries, public libraries, curated literary spaces — barely existed in our daily lives. Yet the books themselves circulated relentlessly through informal networks.`,
    },
    {
      html: `The more I think about it, the clearer it becomes that it did not matter how the books found their way to us.`,
    },
    {
      html: `What mattered is that they did.`,
    },
    {
      html: `Research on reading behavior consistently identifies access to books as the single most powerful predictor of sustained reading habits. When books are present in homes, classrooms, and communities — when they circulate visibly and frequently — children read more.`,
    },
    {
      html: `The 1985 Commission on Reading put it plainly: the home environment provides the child's first lessons in reading. Parents become the first teachers. Long before schools intervene, the rhythms of literacy are already taking shape.`,
    },
  ],
};

export const readingInfrastructure = {
  id: "reading-ecosystem",
  num: "III",
  title: "Reading as Infrastructure",
  paragraphs: [
    {
      html: `My childhood was not defined by formal reading infrastructure. It was defined by living, breathing, reading ecosystems.`,
    },
  ],
  listBurst: [
    "Teachers who enforced reading.",
    "Parents who stocked the house with print.",
    "Friends who smuggled novels into schoolbags.",
    "Books that appeared through improbable channels and disappeared again just as quickly.",
  ],
  paragraphsAfter: [
    {
      html: `In sociological terms, what I was unknowingly accumulating was what Pierre Bourdieu called <em>cultural capital</em> — the habits, dispositions, and intellectual familiarity that allow certain practices to feel natural.`,
    },
    {
      html: `Reading felt less like work and more like an inevitability.`,
    },
    {
      html: `It was <em>habitus</em> at work: a system of durable dispositions quietly shaped by repeated social experiences. Family expectations, classroom practices, peer networks — all converged to produce a child for whom reading was simply what one did.`,
    },
    {
      html: `School, in Bourdieu's analysis, often functions as a conservative institution. It reproduces social hierarchies by rewarding the <em>cultural capital</em> that some children already possess. Yet in my case something slightly different was happening.`,
    },
    {
      html: `The formal structures may have been weak but the informal networks were extraordinarily strong. In their various mutated forms, they created something that looked very much like a reading culture — even if no one had planned it.`,
    },
  ],
};

export const smartphoneShift = {
  id: "smartphone-shift",
  num: "IV",
  title: "The Smartphone Shift",
  paragraphs: [
    {
      html: `Then something shifted.`,
    },
    {
      html: `I got my first smartphone in 2013 when I joined campus. Before that I was using the <em>kabambe</em> my father bought me after Form Four. The latter was a sturdy, uncomplicated device whose main functions were calling, texting, and occasionally reminding you that its battery could last several days without complaint.`,
    },
    {
      html: `The smartphone was different.`,
    },
    {
      html: `At first it did not seem like a threat to reading. I used it sparingly — WhatsApp, texts, the occasional call. The internet was slow. Data bundles were expensive. Long stretches of the day still unfolded offline.`,
    },
    {
      html: `Yet that was also when something subtle began to erode.`,
    },
    {
      html: `I was visiting the campus library. Still buying books. Still identifying myself as a reader.`,
    },
    {
      html: `But the old compulsion had weakened.`,
    },
    {
      html: `Leisure reading became occasional rather than instinctive. Perhaps one book a year. Maybe two.`,
    },
    {
      html: `The shift was gradual enough to escape notice at first.`,
    },
  ],
};

export const theReturn = {
  id: "return",
  num: "V",
  title: "The Return",
  paragraphs: [
    {
      html: `Five years ago I bought my first adult book: Daniel Goleman's <em>Emotional Intelligence</em>. I do not remember how long it took me to finish it. But I remember buying another later that year. And another.`,
    },
    {
      html: `Six years later I now own a box full of books — bought from street vendors, Text Book Centre, and the occasional irresistible bookstore encounter that felt too tempting to resist.`,
    },
    {
      html: `At some point I even made a quiet promise to myself.`,
    },
    {
      html: `One day I would buy a book without calculating the financial sacrifice it required. Yet, if I am honest, my reading is no longer what it used to be.`,
    },
    {
      html: `I have tried digital copies. Long-form articles. Online essays. Nothing quite holds. Paperbacks no longer exert the gravitational pull they once did. Now I often have to convince myself to read. Sometimes even urge myself.`,
    },
    {
      html: `And if I am being completely truthful, there is occasionally a small sigh of relief when I reach the final page.`,
    },
    {
      html: `Not the thrill of continuation.`,
    },
    {
      html: `The satisfaction of completion.`,
    },
  ],
  pullQuote: `That moment — the quiet relief of finishing rather than the excitement of continuing — is perhaps where this story truly begins. Because the cultural capital is still there. The books are still on my shelves. The memories of reading remain vivid. What has quietly withdrawn is the automatic disposition that once made reading effortless.`,
};

export const largerQuestion = {
  id: "larger-question",
  num: "VI",
  title: "The Larger Question",
  paragraphs: [
    {
      html: `Somewhere between the classroom library, the smuggled paperbacks, the <em>kabambe</em> phone, and the glowing smartphone screen, something fundamental shifted.`,
    },
    {
      html: `The question is not merely personal. Across the world, educators, librarians, and researchers have begun to ask similar questions. Why do children who read enthusiastically gradually abandon the habit? My childhood suggests something intriguing. Readers were not produced solely by institutions. They emerged from ecosystems; from the overlapping efforts of teachers, parents, peers, and communities that placed books into circulation. What happens when the ecosystems that once sustained reading begin to fracture? And what replaces them?`,
    },
    {
      html: `If those ecosystems weaken, what happens to the reader?`,
    },
    {
      html: `This series begins with a simple investigation.`,
    },
    {
      html: `How do reading cultures form? How do they survive? And how do they begin to disappear?`,
    },
    {
      html: `To answer those questions, we must first return to a time when reading felt inevitable. A time when the page still held the center of gravity in our intellectual lives. A time when the infrastructures of reading — libraries, classrooms, bookstores, and homes — formed the backbone of a cultural ecosystem that made books unavoidable.`,
    },
    {
      html: `In other words, we must begin with the world that produced readers in the first place.`,
    },
    {
      isCentered: true,
      html: `We must begin with the library era.`,
    },
  ],
};