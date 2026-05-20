import Link from "next/link";

export const metadata = {
  title: "用户协议 · AI Love-Lab",
};

export default function TermsPage() {
  return (
    <main className="min-h-[100svh] px-5 sm:px-8 py-8 sm:py-12 max-w-2xl mx-auto">
      <Link
        href="/"
        className="text-rose-200/55 text-sm hover:text-rose-100"
      >
        ← 回首页
      </Link>

      <h1 className="font-serif-cn text-3xl text-rose-100 mt-6 mb-3">
        用户协议
      </h1>
      <p className="text-rose-200/55 text-sm mb-8">
        最近一次更新：2026-05-14
      </p>

      <section className="space-y-6 text-rose-100/90 text-sm leading-loose">
        <div className="rounded-xl bg-rose-300/10 border border-rose-300/30 px-4 py-3">
          <p className="text-rose-100">
            <strong>使用本服务即视为你已阅读并接受本协议全部条款。</strong>
            如不同意，请立即停止使用。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            一、服务性质
          </h2>
          <p>
            AI Love-Lab（"本服务"）是一款基于人工智能的恋爱关系推演娱乐工具。
            本服务输出的全部内容均为 AI 即兴生成的虚构演绎，
            <strong>不是事实陈述、心理诊断、命理预测或情感建议</strong>。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            二、使用资格
          </h2>
          <ul className="list-disc list-inside space-y-1 text-rose-100/85">
            <li>你必须年满 18 周岁。未满 18 岁不得注册或使用本服务。</li>
            <li>你保证以本人真实意愿使用本服务，不存在被胁迫、被代理等情形。</li>
            <li>本服务不向中国大陆境内未取得相应许可的群体开放运营性服务。</li>
          </ul>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            三、你不可以做的事
          </h2>
          <ul className="list-disc list-inside space-y-1 text-rose-100/85">
            <li>不得输入真实姓名、电话、身份证号、住址、工作单位等可定位他人身份的隐私信息</li>
            <li>不得使用本服务针对特定真实人物进行评价、骚扰、诽谤、人肉</li>
            <li>不得输入违反中华人民共和国法律法规的内容（涉政、涉黄、涉暴、煽动民族仇恨等）</li>
            <li>不得尝试 prompt 注入、越狱、绕过安全过滤等技术手段</li>
            <li>不得将本服务输出冒充为真实分析、命理预测、心理咨询结论对外传播</li>
            <li>不得对服务接口进行爬取、滥用、压力测试或反向工程</li>
          </ul>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            四、AI 生成内容声明
          </h2>
          <p className="mb-2">
            根据《生成式人工智能服务管理暂行办法》（国家互联网信息办公室等七部门，2023），
            本服务为 AI 内容生成服务，所有推演文本、对话片段、预言卡、分析结论均由
            AI 模型即时生成，<strong>可能与真实情况不符、可能存在偏见、可能出现事实错误</strong>。
          </p>
          <p>
            我们不对 AI 输出的准确性、完整性、适用性作任何明示或默示的保证。
            因依赖 AI 输出造成的一切后果（包括但不限于情感决策、人际判断、消费选择）由你自行承担。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            五、知识产权
          </h2>
          <p>
            本服务的代码、界面、文案、设计、视觉素材的著作权及相关权利归本服务运营方所有。
            你通过本服务生成的"预言卡"、"分享卡"图片，可自由用于个人非商业分享，
            但不得删除水印或冒充原创制作；如需商业使用须取得书面授权。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            六、服务变更与中断
          </h2>
          <p>
            本服务可能因维护、升级、不可抗力或合规要求随时调整或暂停。
            对此造成的体验中断，本服务不承担赔偿责任。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            七、违约与责任
          </h2>
          <p>
            你违反本协议任一条款的，本服务有权立即终止你的访问、删除相关数据、保留进一步法律追究的权利。
            因你违约造成本服务运营方损失的（包括法律费用、运维费用、声誉损失等），你应当承担全部赔偿责任。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            八、责任限额
          </h2>
          <p>
            在法律允许的最大限度内，本服务对你的累计赔偿责任以你实际支付的费用为上限；
            本服务为免费服务时，赔偿责任不超过人民币 100 元。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            九、争议解决
          </h2>
          <p>
            本协议适用中华人民共和国法律。如发生争议，应先协商解决；
            协商不成的，提交本服务运营方所在地有管辖权的人民法院诉讼解决。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            十、协议变更
          </h2>
          <p>
            本协议可不定期更新。重要变更将通过站内公告告知。
            继续使用即视为接受最新版本。如不同意，请立即停止使用。
          </p>
        </div>

        <div>
          <h2 className="font-serif-cn text-rose-100 text-lg mb-2">
            十一、联系
          </h2>
          <p>
            协议相关问题请联系：
            <span className="text-rose-300 ml-1">support@example.com</span>
          </p>
        </div>
      </section>

      <div className="mt-12 flex items-center justify-between text-rose-200/60 text-sm">
        <Link href="/legal/privacy" className="hover:text-rose-100">
          隐私声明 →
        </Link>
        <Link href="/" className="hover:text-rose-100">
          ← 回首页
        </Link>
      </div>
    </main>
  );
}
