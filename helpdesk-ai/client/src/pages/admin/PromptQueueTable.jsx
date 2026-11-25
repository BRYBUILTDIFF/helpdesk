export default function PromptQueueTable({insights, formatRelative}) {
  return <div className="prompt-queue-table-wrap"><table className="prompt-queue-table">
    <thead><tr><th scope="col">User request</th><th scope="col">Times asked</th><th scope="col">Last asked</th></tr></thead>
    <tbody>{insights.map(insight=><tr key={insight.normalized || insight.samplePrompt}>
      <td>{insight.samplePrompt}</td><td>{insight.occurrences}</td><td>{formatRelative(insight.lastSeen)}</td>
    </tr>)}</tbody>
  </table></div>;
}
