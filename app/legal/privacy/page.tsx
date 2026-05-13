import Link from "next/link";

export const metadata = {
  title: "隐私声明 · AI Love-Lab",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-[100svh] px-5 sm:px-8 py-8 sm:py-12 max-w-2xl mx-auto">
      <Link
        href="/"
        className="text-rose-200/55 text-sm hover:text-rose-100"
      >
        ← 回首页
      </Link>

      <h1 className="font-serif-cn text-3xl text-rose-100 mt-6 mb-3">
        隐私与使用声明
      </h1>
      <p className="text-rose-200/55 text-sm mb-8">
        最近一次更新：2026-05-12
      </p>

      <section className="space-y-6 text-rose-100/90 text-sm leading-loose">
        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            一、AI Love-Lab 是什么
          </h2>
          <p>
            一个基于 AI
            的"恋爱关系推演娱乐工具"。你和 ta
            的关系会被建模成两个 AI agent，演化 10
            个回合，最终生成一份诗化的关系预言。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            二、这不是什么
          </h2>
          <ul className="list-disc list-inside space-y-1 text-rose-100/85">
            <li>这不是占卜，不预测真实事件</li>
            <li>这不是心理诊断，不能替代咨询</li>
            <li>这不是关系建议，不应作为感情决策依据</li>
            <li>本服务输出由 AI 即兴生成，可能与真实情况完全不符</li>
          </ul>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            三、我们收集和使用的数据
          </h2>
          <p className="mb-2">
            <strong>你提供的：</strong>姓名/昵称、生日、MBTI、ta
            的代称、12 题答题选项。
          </p>
          <p className="mb-2">
            <strong>处理方式：</strong>
            数据仅保存在你浏览器的 localStorage
            中，不会上传到任何服务器进行长期存储。每次推演时会将必要信息发送给
            LLM 服务（仅用于本次推演，模型供应商承诺不存训练）。
          </p>
          <p>
            <strong>关闭浏览器后：</strong>
            数据仍在 localStorage 中保留。如需清除，点击报告页"换一对
            agent 再来一次"或在浏览器设置清除站点数据。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            四、关于 ta 的信息 ⭐
          </h2>
          <div className="rounded-xl bg-rose-300/10 border border-rose-300/30 px-4 py-3">
            <p className="text-rose-100">
              <strong>请勿填写 ta 的真实姓名 / 真实电话 / 真实工作单位 / 任何可定位的隐私信息。</strong>
              <br />
              建议使用代称（如「阿哲」「Lin」「学长」）。AI
              生成的所有内容仅用于你个人参考，不应转发或用于评价真实的人。
            </p>
          </div>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            五、AI 生成内容
          </h2>
          <p>
            本服务输出的所有文字（推演、对话、预言卡、分析）均由 AI
            即兴生成，不代表对任何真实人物的判断。AI
            可能产生不准确、不一致或有偏见的内容。
          </p>
          <p className="mt-2">
            如发现严重不当生成内容，请联系：
            <span className="text-rose-300 ml-1">support@example.com</span>
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            六、年龄限制
          </h2>
          <p>本服务面向 18 岁及以上用户。如你未满 18 岁，请勿使用。</p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            七、变更与联系
          </h2>
          <p>
            本声明可能不定期更新。继续使用即视为接受最新版本。任何问题请联系
            <span className="text-rose-300 ml-1">support@example.com</span>。
          </p>
        </div>
      </section>

      <div className="mt-12 text-center">
        <Link
          href="/"
          className="text-rose-200/60 text-sm hover:text-rose-100"
        >
          ← 回首页
        </Link>
      </div>
    </main>
  );
}
