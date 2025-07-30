'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Zap, Activity, Cpu, HardDrive, TrendingUp, Clock, ArrowLeft } from 'lucide-react'
import { generateDemoData, generateDemoStatusMessages, demoContent, demoSummary, DemoTestResult, DemoStatusMessage } from './demo-data'

interface DemoResultsProps {
  onBack?: () => void
}

export default function DemoResults({ onBack }: DemoResultsProps) {
  const testResults: DemoTestResult[] = generateDemoData()
  const statusMessages: DemoStatusMessage[] = generateDemoStatusMessages()
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="text-center space-y-2 flex-1">
          <h1 className="text-4xl font-bold tracking-tight">LLM Load Test Demo Results</h1>
          <p className="text-muted-foreground">
            Sample performance metrics and visualizations from LLM load testing
          </p>
          <Badge variant="secondary" className="mt-2">
            Demo Data - qwen3:4b-q8_0 Model
          </Badge>
        </div>
        {onBack && (
          <div className="flex gap-2 ml-4">
            <Button
              variant="outline"
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Max Concurrency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demoSummary.maxConcurrency}</div>
            <p className="text-xs text-muted-foreground">concurrent requests handled</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demoSummary.avgLatency.toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground">average response time</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Throughput</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demoSummary.avgThroughput.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">tokens per second</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak GPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demoSummary.peakGpuUsage}%</div>
            <p className="text-xs text-muted-foreground">maximum utilization</p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Status Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sample Test Execution Log
          </CardTitle>
          <CardDescription>
            Real-time status updates from a sample load test execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48 w-full border rounded-md p-4">
            <div className="space-y-1">
              {statusMessages.map((msg, index) => (
                <div key={index} className="text-sm flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {new Date(msg.time).toLocaleTimeString()}
                  </Badge>
                  <span>{msg.msg}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Sample Generated Content:</div>
            <ScrollArea className="h-24 w-full border rounded-md p-2">
              <p className="text-sm">{demoContent}</p>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Detailed Test Results
          </CardTitle>
          <CardDescription>
            Model: {demoSummary.model} | Max concurrency: {demoSummary.maxConcurrency} | Total tests: {demoSummary.totalTests}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concurrency</TableHead>
                  <TableHead>Latency (s)</TableHead>
                  <TableHead>Throughput (tok/s)</TableHead>
                  <TableHead>Prompt (tok/s)</TableHead>
                  <TableHead>Total Tokens</TableHead>
                  <TableHead>Load Time (s)</TableHead>
                  <TableHead>Eval Time (s)</TableHead>
                  <TableHead>GPU Δ (%)</TableHead>
                  <TableHead>RAM Δ (%)</TableHead>
                  <TableHead>GPU Mem Δ (MB)</TableHead>
                  <TableHead>RAM Mem Δ (GB)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{result.concurrency}</TableCell>
                    <TableCell>{result.latency.toFixed(2)}</TableCell>
                    <TableCell>{result.throughput.toFixed(2)}</TableCell>
                    <TableCell>{result.promptThroughput.toFixed(2)}</TableCell>
                    <TableCell>{result.totalTokens}</TableCell>
                    <TableCell>{result.loadTime.toFixed(2)}</TableCell>
                    <TableCell>{result.evalTime.toFixed(2)}</TableCell>
                    <TableCell>{result.gpuDelta.toFixed(1)}</TableCell>
                    <TableCell>{result.ramDelta.toFixed(1)}</TableCell>
                    <TableCell>{result.gpuMemoryDelta.toFixed(0)}</TableCell>
                    <TableCell>{result.ramMemoryDelta.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Visualizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Performance Visualizations
          </CardTitle>
          <CardDescription>
            Interactive charts showing performance metrics across different concurrency levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="latency" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="latency">Latency</TabsTrigger>
              <TabsTrigger value="throughput">Throughput</TabsTrigger>
              <TabsTrigger value="resources">Resource Usage</TabsTrigger>
              <TabsTrigger value="memory">Memory Usage</TabsTrigger>
              <TabsTrigger value="timing">Timing Breakdown</TabsTrigger>
            </TabsList>
            
            <TabsContent value="latency" className="space-y-4">
              <div className="h-80">
                <h3 className="text-lg font-semibold mb-4">Latency vs Concurrency</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={testResults}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="concurrency" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [`${Number(value).toFixed(2)}s`, 'Latency']}
                      labelFormatter={(value) => `Concurrency: ${value}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="latency" 
                      stroke="#8884d8" 
                      strokeWidth={3}
                      dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Response Latency (seconds)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                <p>📈 Latency increases with concurrency due to resource contention and queueing effects.</p>
                <p>📊 At 8 concurrent requests, latency is 5.8x higher than at 1 concurrent request.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="throughput" className="space-y-4">
              <div className="h-80">
                <h3 className="text-lg font-semibold mb-4">Throughput vs Concurrency</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={testResults}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="concurrency" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${Number(value).toFixed(2)} tokens/s`, 
                        name === 'throughput' ? 'Token Throughput' : 'Prompt Throughput'
                      ]}
                      labelFormatter={(value) => `Concurrency: ${value}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="throughput" 
                      stroke="#82ca9d" 
                      strokeWidth={3}
                      dot={{ fill: '#82ca9d', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Token Throughput (tokens/sec)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="promptThroughput" 
                      stroke="#ffc658" 
                      strokeWidth={3}
                      dot={{ fill: '#ffc658', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Prompt Throughput (tokens/sec)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                <p>📉 Throughput decreases as concurrency increases due to system overhead.</p>
                <p>⚡ Token throughput drops 76% from 1 to 8 concurrent requests.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="resources" className="space-y-4">
              <div className="h-80">
                <h3 className="text-lg font-semibold mb-4">Resource Usage vs Concurrency</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={testResults}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="concurrency" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${Number(value).toFixed(1)}%`, 
                        name === 'gpuDelta' ? 'GPU Utilization Delta' : 'RAM Utilization Delta'
                      ]}
                      labelFormatter={(value) => `Concurrency: ${value}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="gpuDelta" 
                      stroke="#ff7300" 
                      strokeWidth={3}
                      dot={{ fill: '#ff7300', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="GPU Utilization Delta (%)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ramDelta" 
                      stroke="#00ff00" 
                      strokeWidth={3}
                      dot={{ fill: '#00ff00', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="RAM Utilization Delta (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                <p>🔥 GPU utilization increases linearly with concurrency, reaching 56.8% at 8 concurrent requests.</p>
                <p>💾 RAM utilization also increases steadily, indicating memory pressure.</p>
              </div>
            </TabsContent>

            <TabsContent value="memory" className="space-y-4">
              <div className="h-80">
                <h3 className="text-lg font-semibold mb-4">Memory Usage vs Concurrency</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={testResults}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="concurrency" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'gpuMemoryDelta' ? `${Number(value).toFixed(0)} MB` : `${Number(value).toFixed(2)} GB`,
                        name === 'gpuMemoryDelta' ? 'GPU Memory Delta' : 'RAM Memory Delta'
                      ]}
                      labelFormatter={(value) => `Concurrency: ${value}`}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="gpuMemoryDelta" 
                      stackId="1"
                      stroke="#ff7300" 
                      fill="#ff7300"
                      fillOpacity={0.6}
                      name="GPU Memory Delta (MB)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ramMemoryDelta" 
                      stackId="2"
                      stroke="#00ff00" 
                      fill="#00ff00"
                      fillOpacity={0.6}
                      name="RAM Memory Delta (GB)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                <p>🎮 GPU memory usage increases significantly with concurrency (6.7x from 1 to 8 requests).</p>
                <p>🧠 RAM memory delta shows increasing memory allocation during processing.</p>
              </div>
            </TabsContent>

            <TabsContent value="timing" className="space-y-4">
              <div className="h-80">
                <h3 className="text-lg font-semibold mb-4">Timing Breakdown vs Concurrency</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={testResults}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="concurrency" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${Number(value).toFixed(2)}s`,
                        name === 'loadTime' ? 'Load Time' : 'Evaluation Time'
                      ]}
                      labelFormatter={(value) => `Concurrency: ${value}`}
                    />
                    <Legend />
                    <Bar 
                      dataKey="loadTime" 
                      fill="#8884d8" 
                      name="Load Time (seconds)"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar 
                      dataKey="evalTime" 
                      fill="#82ca9d" 
                      name="Evaluation Time (seconds)"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                <p>⏱️ Both load time and evaluation time increase with concurrency.</p>
                <p>📊 Evaluation time grows faster than load time, indicating processing bottlenecks.</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Key Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">🚀 Performance Observations</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Optimal concurrency: 1-2 requests for best latency</li>
                <li>• Throughput peaks at lower concurrency levels</li>
                <li>• System handles up to 8 concurrent requests reliably</li>
                <li>• GPU becomes bottleneck at higher concurrency</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">⚡ Resource Utilization</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• GPU usage scales linearly with concurrency</li>
                <li>• Memory usage increases significantly</li>
                <li>• RAM utilization remains manageable</li>
                <li>• Peak GPU usage reaches 88.6% at max concurrency</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}